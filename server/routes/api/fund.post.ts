import { defineHandler } from "nitro";
import type { Address } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

import { createTestnetClients } from "../../lib/testnetClients";

type FundBody = {
  address?: Address;
  wei?: string;
};

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Fund a smart-account address with test ETH from the server funder wallet. */
export default defineHandler(async (event) => {
  try {
    const { address, wei } = (await event.req.json()) as FundBody;
    if (!address || !wei) {
      return jsonError("address and wei are required", 400);
    }

    const value = BigInt(wei);
    if (value <= 0n) {
      return jsonError("wei must be positive", 400);
    }

    const { publicClient, walletClient } = createTestnetClients();
    const hash = await walletClient.sendTransaction({ to: address, value });
    await waitForTransactionReceipt(publicClient, { hash });

    return { ok: true, hash };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error));
  }
});
