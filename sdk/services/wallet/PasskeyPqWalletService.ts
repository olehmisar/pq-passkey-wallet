import type { Address, Hex } from "viem";
import { BaseError, formatEther, parseEther } from "viem";
import { getBalance, getBytecode } from "viem/actions";
import type { AppPublicClient } from "../../utils";
import type { AaDeploymentConfig } from "../../config/aa";
import { WalletNotFoundError } from "../../errors";
import type { ViemAccountAbstractionService } from "../aa/AccountAbstractionService";
import { DirectUserOperationService } from "../aa/DirectUserOperationService";
import {
  cappedUserOpFees,
  conservativeUserOpPrefund,
  PQ_DEPLOY_USER_OP_GAS,
  PQ_USER_OP_GAS,
  recommendedTestFundingWei,
} from "../aa/userOpGas";
import { serializeUserOperation } from "../aa/userOperationCodec";
import { toPqSimpleSmartAccount } from "../aa/toPqSimpleSmartAccount";
import type { PqKeyServiceLike } from "../crypto/MlDsaPqKeyService";
import { LargeBlobService } from "../webauthn/LargeBlobService";
import { PasskeyService } from "../webauthn/PasskeyService";
import { rpIdOrDefault } from "../webauthn/helpers";
import { WalletSessionService } from "./WalletSessionService";
import { deserializePasskeyWalletBlob, serializePasskeyWalletBlob } from "./walletBlobCodec";
import { apiRoute } from "../apiRoutes";
import type { CreateWalletOptions } from "./createWalletProgress";
import { createWalletUserId, userIdToBytes } from "./walletUserId";

/** Serialized PQ wallet payload stored in passkey largeBlob. */
export type WalletBlobV1 = {
  version: 1;
  /** Stable WebAuthn user handle — binds passkey registration to this wallet. */
  userId?: string;
  /** ML-DSA-44 deployment public key (hex). */
  pqPublicKeyHex: `0x${string}`;
  /** PQ seed (hex). Present only during createWallet before stripPublic; never in localStorage. */
  pqSecretHex?: `0x${string}`;
  /** SSTORE2 pk pointer from `ZKNOX_dilithium.setKey`. */
  pkPointer?: `0x${string}`;
  /** ERC-4337 counterfactual / deployed smart-account address. */
  accountAddress?: `0x${string}`;
  /** CREATE2 salt used with `PqSimpleAccountFactory`. */
  accountSalt?: string;
  createdAt: string;
};

export type PasskeyCredentialRef = {
  id: string;
  rpId: string;
};

export type WalletRecord = {
  credential: PasskeyCredentialRef;
  blob: WalletBlobV1;
};

type Deps = {
  passkey: PasskeyService;
  largeBlob: LargeBlobService;
  pqKey: PqKeyServiceLike;
  publicClient: AppPublicClient;
  aa: ViemAccountAbstractionService;
  aaConfig: AaDeploymentConfig;
  bundlerPrivateKey?: Hex;
};

export class PasskeyPqWalletService {
  private readonly deps: Deps;
  private readonly session = new WalletSessionService();
  private readonly directUserOps: DirectUserOperationService;

  constructor(deps: Deps) {
    this.deps = deps;
    this.directUserOps = new DirectUserOperationService(deps.publicClient);
  }

  /** Restore a signed-in session from localStorage (public metadata only). */
  restoreSession(): { record: WalletRecord; displayName: string } | null {
    return this.session.restore();
  }

  clearSession(): void {
    this.session.clear();
  }

  async createWallet(displayName: string, options?: CreateWalletOptions): Promise<WalletRecord> {
    const report = options?.onProgress;

    const userId = createWalletUserId();
    report?.("passkey");
    const credential = await this.deps.passkey.create({
      displayName,
      rpId: rpIdOrDefault(),
      userId: userIdToBytes(userId),
    });

    report?.("pq-keys");
    const pq = await this.deps.pqKey.generateKeyPair();

    report?.("register-key");
    const pkPointer = await this.deps.aa.registerPublicKey(pq.publicKeyHex);
    const accountAddress = this.deps.aaConfig.pqAccountFactoryAddress
      ? await this.deps.aa.getCounterfactualAddress(pkPointer)
      : undefined;

    const blob: WalletBlobV1 = {
      version: 1,
      userId,
      pqPublicKeyHex: pq.publicKeyHex,
      pqSecretHex: pq.secretHex,
      pkPointer,
      accountAddress,
      accountSalt: String(this.deps.aaConfig.accountSalt ?? 0n),
      createdAt: new Date().toISOString(),
    };

    report?.("save-blob");
    await this.deps.largeBlob.write({
      credentialId: credential.id,
      blob: serializePasskeyWalletBlob(blob),
      rpId: rpIdOrDefault(),
    });

    const record = this.session.stripPublic({
      credential: { id: credential.id, rpId: rpIdOrDefault() },
      blob,
    });
    this.session.persist(record, displayName);

    if (accountAddress) {
      report?.("fund");
      await this.fundRecommendedTestEth(record);
    }

    return record;
  }

  async signIn(displayName: string): Promise<WalletRecord> {
    this.session.clear();
    const record = await this.signInDiscoverable();
    this.session.persist(record, displayName);
    return record;
  }

  private async signInDiscoverable(): Promise<WalletRecord> {
    const { credentialId, blob: bytes } = await this.deps.largeBlob.readDiscoverable({
      rpId: rpIdOrDefault(),
    });
    if (!bytes?.length) throw new WalletNotFoundError();
    return this.session.stripPublic(this.recordFromBlob(credentialId, bytes));
  }

  private recordFromBlob(credentialId: string, bytes: Uint8Array): WalletRecord {
    return {
      credential: { id: credentialId, rpId: rpIdOrDefault() },
      blob: deserializePasskeyWalletBlob(bytes),
    };
  }

  private async readPasskeyWalletBlob(record: WalletRecord): Promise<WalletBlobV1> {
    const { blob: bytes } = await this.deps.largeBlob.read({
      credentialId: record.credential.id,
      rpId: record.credential.rpId,
    });
    if (!bytes?.length) throw new WalletNotFoundError();
    return deserializePasskeyWalletBlob(bytes);
  }

  /** Passkey + largeBlob unlock on every call — PQ seed is never cached in memory. */
  private async loadSigningSecret(record: WalletRecord): Promise<Hex> {
    const blob = await this.readPasskeyWalletBlob(record);
    const secret = blob.pqSecretHex;
    if (!secret) throw new Error("Wallet blob missing PQ secret");
    return secret;
  }

  async getBalance(record: WalletRecord): Promise<bigint> {
    const address = this.requireAccountAddress(record);
    return getBalance(this.deps.publicClient, { address });
  }

  async fundRecommendedTestEth(record: WalletRecord): Promise<void> {
    const sender = this.requireAccountAddress(record);
    const senderCode = await getBytecode(this.deps.publicClient, { address: sender });
    const gasLimits = !senderCode || senderCode === "0x" ? PQ_DEPLOY_USER_OP_GAS : PQ_USER_OP_GAS;
    const fees = await cappedUserOpFees(this.deps.publicClient);
    const wei = recommendedTestFundingWei(gasLimits, fees.maxFeePerGas);
    await this.fundWithTestEth(record, formatEther(wei));
  }

  async fundWithTestEth(record: WalletRecord, ether = "1"): Promise<void> {
    const address = this.requireAccountAddress(record);
    const value = parseEther(ether);

    const response = await fetch(apiRoute("/api/dev/fund", "/api/fund"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, wei: value.toString() }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(json.error ?? "fund failed");
  }

  async sendEth(record: WalletRecord, params: { to: Address; value: bigint }): Promise<Hex> {
    const account = await this.getSmartAccount(record);
    const pkPointer = record.blob.pkPointer;
    if (!pkPointer) {
      throw new Error("Wallet blob missing pkPointer");
    }

    const calls = [{ to: params.to, value: params.value }] as const;
    const sender = this.requireAccountAddress(record);
    const senderCode = await getBytecode(this.deps.publicClient, { address: sender });
    const gasLimits = !senderCode || senderCode === "0x" ? PQ_DEPLOY_USER_OP_GAS : PQ_USER_OP_GAS;
    const fees = await cappedUserOpFees(this.deps.publicClient);
    const prefund = conservativeUserOpPrefund(gasLimits, fees.maxFeePerGas);
    const balance = await getBalance(this.deps.publicClient, { address: sender });
    if (balance < prefund + params.value) {
      throw new Error(
        `Insufficient balance: need ~${formatEther(prefund + params.value)} ETH ` +
          `(prefund ~${formatEther(prefund)} + send ${formatEther(params.value)}), ` +
          `have ${formatEther(balance)} ETH — use "Add test ETH"`,
      );
    }

    const entryPoint = this.deps.aaConfig.entryPointAddress;
    const verifier = this.deps.aaConfig.mlDsaVerifierAddress;
    if (!verifier) {
      throw new BaseError("Send requires VITE_ML_DSA_VERIFIER");
    }

    const userOperation = await this.directUserOps.prepareSignedVerified({
      entryPoint,
      verifier,
      account,
      pkPointer,
      calls: [...calls],
    });
    const response = await fetch(apiRoute("/api/dev/handle-ops", "/api/handle-ops"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entryPoint,
        userOperation: serializeUserOperation(userOperation),
      }),
    });
    const body = await response.text();
    let json: { hash?: Hex; error?: string };
    try {
      json = JSON.parse(body) as { hash?: Hex; error?: string };
    } catch {
      throw new Error(
        body.trimStart().startsWith("<")
          ? "Handle-ops API unavailable — check server env on Vercel."
          : body.slice(0, 200) || "handle-ops returned invalid JSON",
      );
    }
    if (!response.ok || !json.hash) {
      throw new Error(json.error ?? "handle-ops failed");
    }
    return json.hash;
  }

  private requireAccountAddress(record: WalletRecord): Address {
    const address = record.blob.accountAddress;
    if (!address) {
      throw new BaseError(
        "Wallet missing smart-account address — set VITE_PQ_ACCOUNT_FACTORY and recreate the wallet",
      );
    }
    return address;
  }

  /** Build a viem Smart Account; each sign triggers passkey + largeBlob unlock. */
  async getSmartAccount(record: WalletRecord) {
    const pkPointer = record.blob.pkPointer;
    if (!pkPointer) {
      throw new Error("Wallet blob missing pkPointer — recreate wallet after AA integration");
    }

    return toPqSimpleSmartAccount({
      client: this.deps.publicClient,
      deployment: this.deps.aaConfig,
      pkPointer,
      address: record.blob.accountAddress,
      signer: {
        signUserOperationHash: async (userOpHash: Hex) => {
          const secret = await this.loadSigningSecret(record);
          return this.deps.pqKey.signUserOperationHash(secret, userOpHash);
        },
      },
    });
  }
}
