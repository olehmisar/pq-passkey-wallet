import { describe, expect, it } from "vite-plus/test";
import { createPublicClient, createWalletClient, http, parseEther, hexToBytes } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DirectUserOperationService } from "./DirectUserOperationService";
import { deserializeUserOperation, serializeUserOperation } from "./userOperationCodec";
import { toPqSimpleSmartAccount } from "./toPqSimpleSmartAccount";
import { ViemAccountAbstractionService } from "./AccountAbstractionService";
import { MlDsaPqKeyService } from "../crypto/MlDsaPqKeyService";
import { preparePublicKeyFromSeed } from "../crypto/mlDsaDeployment";
import { ANVIL_PRIVATE_KEY, PQ_TEST_SEED } from "../../e2e/constants";

function loadEnvLocal() {
  const envPath = join(fileURLToPath(new URL("../../../.env.local", import.meta.url)));
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf8").trim().split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key) env[key] = rest.join("=");
  }
  return env;
}

describe("userOperationCodec (local anvil)", () => {
  it("round-trips and submits via handleOps", async () => {
    const env = loadEnvLocal();
    const rpc = env.VITE_RPC_URL!;
    const chainId = Number(env.VITE_CHAIN_ID);
    const entryPoint = env.VITE_ENTRY_POINT_ADDRESS as `0x${string}`;
    const verifier = env.VITE_ML_DSA_VERIFIER as `0x${string}`;
    const factory = env.VITE_PQ_ACCOUNT_FACTORY as `0x${string}`;
    const deployerKey = ANVIL_PRIVATE_KEY;
    const chain = {
      id: chainId,
      name: "dev",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    };

    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const aa = {
      rpcUrl: rpc,
      chainId,
      entryPointAddress: entryPoint,
      entryPointVersion: "0.9" as const,
      pqAccountFactoryAddress: factory,
      mlDsaVerifierAddress: verifier,
      accountSalt: 0n,
    };

    const secret = `0x${PQ_TEST_SEED}` as const;
    const pqKey = new MlDsaPqKeyService();
    const publicKeyHex = preparePublicKeyFromSeed(hexToBytes(secret));
    const aaSvc = new ViemAccountAbstractionService({
      publicClient,
      deployment: aa,
      deployerPrivateKey: deployerKey,
    });
    const pkPointer = await aaSvc.registerPublicKey(publicKeyHex);
    const accountAddress = await aaSvc.getCounterfactualAddress(pkPointer);
    const smartAccount = await toPqSimpleSmartAccount({
      client: publicClient,
      deployment: aa,
      pkPointer,
      address: accountAddress,
      signer: {
        signUserOperationHash: (hash) => pqKey.signUserOperationHash(secret, hash),
      },
    });

    await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "anvil_setBalance",
        params: [accountAddress, `0x${(10n ** 21n).toString(16)}`],
      }),
    });

    const svc = new DirectUserOperationService(publicClient);
    const prepared = await svc.prepareSignedVerified({
      entryPoint,
      verifier,
      account: smartAccount,
      pkPointer,
      calls: [{ to: "0x000000000000000000000000000000000000dEaD", value: parseEther("0.01") }],
    });

    const deserialized = deserializeUserOperation(serializeUserOperation(prepared));
    const balanceBefore = await publicClient.getBalance({ address: accountAddress });
    const bundler = privateKeyToAccount(generatePrivateKey());
    await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "anvil_setBalance",
        params: [bundler.address, `0x${(10n ** 21n).toString(16)}`],
      }),
    });
    const bundlerWallet = createWalletClient({
      account: bundler,
      chain,
      transport: http(rpc),
    });

    await svc.submitHandleOps({
      entryPoint,
      walletClient: bundlerWallet,
      userOperation: deserialized,
      beneficiary: bundler.address,
    });

    const balanceAfter = await publicClient.getBalance({ address: accountAddress });
    expect(balanceAfter).toBeLessThan(balanceBefore);
    expect(balanceBefore - balanceAfter).toBeGreaterThanOrEqual(parseEther("0.01"));
  }, 120_000);
});
