import type { Address, Hex } from "viem";
import type { AppPublicClient } from "../../utils";
import { BaseError, http } from "viem";
import {
  bundlerActions,
  createBundlerClient,
  prepareUserOperation,
  waitForUserOperationReceipt,
  type SmartAccount,
} from "viem/account-abstraction";
import {
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient } from "viem";
import type { AaDeploymentConfig } from "../../config/aa";
import { mlDsaVerifierAbi, pqSimpleAccountFactoryAbi } from "../../contracts/abis";
import { apiRoute } from "../apiRoutes";

type Deps = {
  publicClient: AppPublicClient;
  deployment: AaDeploymentConfig;
  deployerPrivateKey?: Hex;
};

function pkPointerFromSetKeyResult(encoded: Hex): Address {
  const hex = encoded.startsWith("0x") ? encoded.slice(2) : encoded;
  return `0x${hex.slice(-40)}` as Address;
}

export class ViemAccountAbstractionService {
  private readonly deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  async getCounterfactualAddress(pkPointer: Address): Promise<Address> {
    const factory = this.deps.deployment.pqAccountFactoryAddress;
    if (!factory) {
      throw new BaseError("pqAccountFactoryAddress is not configured");
    }
    return readContract(this.deps.publicClient, {
      address: factory,
      abi: pqSimpleAccountFactoryAbi,
      functionName: "getAddress",
      args: [pkPointer, this.deps.deployment.accountSalt ?? 0n],
    });
  }

  async registerPublicKey(publicKeyHex: Hex): Promise<Address> {
    const verifier = this.deps.deployment.mlDsaVerifierAddress;
    if (!verifier) {
      throw new BaseError(
        "mlDsaVerifierAddress is required — set VITE_ML_DSA_VERIFIER or aa.mlDsaVerifierAddress",
      );
    }

    if (!this.deps.deployerPrivateKey) {
      return this.registerPublicKeyViaApi(verifier, publicKeyHex);
    }

    const account = privateKeyToAccount(this.deps.deployerPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: this.deps.publicClient.chain,
      transport: http(this.deps.deployment.rpcUrl),
    });

    const { request, result } = await simulateContract(this.deps.publicClient, {
      address: verifier,
      abi: mlDsaVerifierAbi,
      functionName: "setKey",
      args: [publicKeyHex],
      account,
    });
    const hash = await writeContract(walletClient, request);
    await waitForTransactionReceipt(this.deps.publicClient, { hash });
    return pkPointerFromSetKeyResult(result);
  }

  private async registerPublicKeyViaApi(verifier: Address, publicKeyHex: Hex): Promise<Address> {
    const response = await fetch(apiRoute("/api/dev/set-key", "/api/set-key"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verifier, publicKeyHex }),
    });
    const body = await response.text();
    let json: { pkPointer?: Address; error?: string };
    try {
      json = JSON.parse(body) as { pkPointer?: Address; error?: string };
    } catch {
      throw new BaseError(
        body.trimStart().startsWith("<")
          ? "Set-key API unavailable — restart the dev server or check Vercel env."
          : body.slice(0, 200) || "set-key returned invalid JSON",
      );
    }
    if (!response.ok || !json.pkPointer) {
      throw new BaseError(json.error ?? "set-key failed");
    }
    return json.pkPointer;
  }

  async sendUserOperation(
    account: SmartAccount,
    calls: NonNullable<Parameters<typeof prepareUserOperation>[1]["calls"]>,
  ): Promise<Hex> {
    const bundlerUrl = this.deps.deployment.bundlerUrl;
    if (!bundlerUrl) {
      throw new BaseError("bundlerUrl is required — set VITE_BUNDLER_URL");
    }

    const bundlerClient = createBundlerClient({
      account,
      client: this.deps.publicClient,
      transport: http(bundlerUrl),
      chain: this.deps.publicClient.chain,
    }).extend(bundlerActions);

    const userOpHash = await bundlerClient.sendUserOperation({
      account,
      calls,
    });

    await waitForUserOperationReceipt(bundlerClient, { hash: userOpHash });
    return userOpHash;
  }
}
