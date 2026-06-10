import { defineHandler } from "nitro";
import type { Address, Hex } from "viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { simulateContract, waitForTransactionReceipt, writeContract } from "viem/actions";

import { mlDsaVerifierAbi } from "../../../../sdk/contracts/abis";
import { DEV_DEPLOYER_PRIVATE_KEY } from "../../../lib/devDeployer";
import { DEV_CHAIN_ID, DEV_RPC_URL } from "../../../lib/devConstants";

type SetKeyBody = {
  verifier?: Address;
  publicKeyHex?: Hex;
};

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pkPointerFromSetKeyResult(encoded: Hex): Address {
  const hex = encoded.startsWith("0x") ? encoded.slice(2) : encoded;
  return `0x${hex.slice(-40)}` as Address;
}

/** Dev-only ML-DSA setKey relay — deployer key stays on the server. */
export default defineHandler(async (event) => {
  try {
    const { verifier, publicKeyHex } = (await event.req.json()) as SetKeyBody;
    if (!verifier || !publicKeyHex) {
      return jsonError("verifier and publicKeyHex are required", 400);
    }

    const chain = {
      id: DEV_CHAIN_ID,
      name: "dev",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [DEV_RPC_URL] } },
    };
    const deployer = privateKeyToAccount(DEV_DEPLOYER_PRIVATE_KEY);
    const publicClient = createPublicClient({ chain, transport: http(DEV_RPC_URL) });
    const walletClient = createWalletClient({
      account: deployer,
      chain,
      transport: http(DEV_RPC_URL),
    });

    const { request, result } = await simulateContract(publicClient, {
      address: verifier,
      abi: mlDsaVerifierAbi,
      functionName: "setKey",
      args: [publicKeyHex],
      account: deployer,
    });
    const hash = await writeContract(walletClient, request);
    await waitForTransactionReceipt(publicClient, { hash });

    return { pkPointer: pkPointerFromSetKeyResult(result) };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error));
  }
});
