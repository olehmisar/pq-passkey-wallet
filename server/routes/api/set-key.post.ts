import { defineHandler } from "nitro";
import type { Address, Hex } from "viem";
import { simulateContract, waitForTransactionReceipt, writeContract } from "viem/actions";

import { mlDsaVerifierAbi } from "../../../sdk/contracts/abis";
import { createTestnetClients } from "../../lib/testnetClients";

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

/** Relay ML-DSA `setKey` on testnet — funder key stays on the server. */
export default defineHandler(async (event) => {
  try {
    const { verifier, publicKeyHex } = (await event.req.json()) as SetKeyBody;
    if (!verifier || !publicKeyHex) {
      return jsonError("verifier and publicKeyHex are required", 400);
    }

    const { account, publicClient, walletClient } = createTestnetClients();
    const { request, result } = await simulateContract(publicClient, {
      address: verifier,
      abi: mlDsaVerifierAbi,
      functionName: "setKey",
      args: [publicKeyHex],
      account,
    });
    const hash = await writeContract(walletClient, request);
    await waitForTransactionReceipt(publicClient, { hash });

    return { pkPointer: pkPointerFromSetKeyResult(result), hash };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error));
  }
});
