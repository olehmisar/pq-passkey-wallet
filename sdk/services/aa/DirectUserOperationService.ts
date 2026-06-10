import type { Address, Client, Hex, WalletClient } from "viem";
import { encodeFunctionData, encodePacked } from "viem";
import {
  entryPoint09Abi,
  getUserOperationHash,
  prepareUserOperation,
  toPackedUserOperation,
  type SmartAccount,
  type UserOperation,
} from "viem/account-abstraction";
import {
  call,
  estimateGas,
  getBytecode,
  readContract,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { mlDsaVerifierAbi } from "../../contracts/abis";
import { cappedUserOpFees, PQ_DEPLOY_USER_OP_GAS, PQ_USER_OP_GAS } from "./userOpGas";

const SIG_VERIFY_SELECTOR = "0x024ad318" as const;

/** Sepolia public RPCs reject txs above 16M gas. */
const SEPOLIA_TX_GAS_CAP = 16_777_216n;

function decodeAaErrorCode(hexData: string): string | undefined {
  for (let i = 2; i + 8 <= hexData.length; i += 2) {
    if (hexData.slice(i, i + 4) !== "4141") continue;
    const d1 = Number.parseInt(hexData.slice(i + 4, i + 6), 16);
    const d2 = Number.parseInt(hexData.slice(i + 6, i + 8), 16);
    if (d1 >= 0x30 && d1 <= 0x39 && d2 >= 0x30 && d2 <= 0x39) {
      return `AA${String.fromCharCode(d1)}${String.fromCharCode(d2)}`;
    }
  }
  return undefined;
}

function decodeHandleOpsError(error: unknown): string | undefined {
  const walk = (e: unknown): string | undefined => {
    if (!e || typeof e !== "object") return undefined;
    const err = e as { data?: string; cause?: unknown; message?: string };
    if (typeof err.data === "string") {
      const aa = decodeAaErrorCode(err.data);
      if (aa) return aa;
    }
    return err.cause ? walk(err.cause) : err.message;
  };
  return walk(error);
}

type Calls = NonNullable<Parameters<typeof prepareUserOperation>[1]["calls"]>;

export class DirectUserOperationService {
  private readonly publicClient: Client;

  constructor(publicClient: Client) {
    this.publicClient = publicClient;
  }

  /** PQ sign + on-chain ML-DSA verify — runs in the browser. */
  async prepareSignedVerified(params: {
    entryPoint: Address;
    verifier: Address;
    account: SmartAccount;
    pkPointer: Address;
    calls: Calls;
  }): Promise<UserOperation<"0.9">> {
    const sender = await params.account.getAddress();
    const senderCode = await getBytecode(this.publicClient, { address: sender });
    const gas = !senderCode || senderCode === "0x" ? PQ_DEPLOY_USER_OP_GAS : PQ_USER_OP_GAS;
    const fees = await cappedUserOpFees(this.publicClient);
    const nonce = await readContract(this.publicClient, {
      address: params.entryPoint,
      abi: entryPoint09Abi,
      functionName: "getNonce",
      args: [sender, 0n],
    });

    const prepared = await prepareUserOperation(this.publicClient as never, {
      account: params.account,
      calls: params.calls,
      ...gas,
      ...fees,
      nonce,
    });

    const preparedOp = prepared as UserOperation<"0.9">;
    const signature = await params.account.signUserOperation(preparedOp);
    const userOperation = { ...preparedOp, signature } as UserOperation<"0.9">;
    const userOpHash = getUserOperationHash({
      chainId: this.publicClient.chain!.id,
      entryPointAddress: params.entryPoint,
      entryPointVersion: "0.9",
      userOperation: { ...userOperation, sender },
    });
    const verifyResult = await readContract(this.publicClient, {
      address: params.verifier,
      abi: mlDsaVerifierAbi,
      functionName: "verify",
      args: [encodePacked(["address"], [params.pkPointer]), userOpHash, signature],
    });
    if (verifyResult !== SIG_VERIFY_SELECTOR) {
      throw new Error(`ML-DSA verify failed (got ${verifyResult})`);
    }

    return userOperation;
  }

  /** Submit a signed UserOp via `handleOps` — dev bundler EOA only (never in browser). */
  async submitHandleOps(params: {
    entryPoint: Address;
    walletClient: WalletClient;
    userOperation: UserOperation<"0.9">;
    beneficiary: Address;
  }): Promise<Hex> {
    const packed = toPackedUserOperation(params.userOperation);
    const handleOpsData = encodeFunctionData({
      abi: entryPoint09Abi,
      functionName: "handleOps",
      args: [[packed], params.beneficiary],
    });

    const bundler = params.walletClient.account!.address;
    const estimated = await estimateGas(this.publicClient, {
      account: bundler,
      to: params.entryPoint,
      data: handleOpsData,
    });
    const gasLimit =
      estimated + estimated / 5n > SEPOLIA_TX_GAS_CAP
        ? SEPOLIA_TX_GAS_CAP
        : estimated + estimated / 5n;

    try {
      await call(this.publicClient, {
        account: bundler,
        to: params.entryPoint,
        data: handleOpsData,
        gas: gasLimit,
      });
    } catch (error) {
      const decoded = decodeHandleOpsError(error);
      const message = decoded ?? (error instanceof Error ? error.message : String(error));
      throw new Error(`handleOps eth_call failed: ${message}`, { cause: error });
    }

    // @ts-expect-error PackedUserOperation typing for EntryPoint v0.9 is strict in viem.
    const hash = await writeContract(params.walletClient, {
      address: params.entryPoint,
      abi: entryPoint09Abi,
      functionName: "handleOps",
      args: [[packed], params.beneficiary],
      gas: gasLimit,
    });
    const receipt = await waitForTransactionReceipt(this.publicClient, { hash });
    if (receipt.status !== "success") {
      throw new Error(
        `handleOps reverted (tx ${hash}, logs ${receipt.logs.length}, gasUsed ${receipt.gasUsed})`,
      );
    }
    return hash;
  }

  async submit(params: {
    entryPoint: Address;
    verifier: Address;
    walletClient: WalletClient;
    account: SmartAccount;
    pkPointer: Address;
    beneficiary: Address;
    calls: Calls;
  }): Promise<Hex> {
    const userOperation = await this.prepareSignedVerified({
      entryPoint: params.entryPoint,
      verifier: params.verifier,
      account: params.account,
      pkPointer: params.pkPointer,
      calls: params.calls,
    });
    return this.submitHandleOps({
      entryPoint: params.entryPoint,
      walletClient: params.walletClient,
      userOperation,
      beneficiary: params.beneficiary,
    });
  }
}
