import { defineHandler } from "nitro";
import type { Address } from "viem";

import { DEV_RPC_URL } from "../../../lib/devConstants";

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

/** Dev-only Anvil helper — adds test ETH to an address. */
export default defineHandler(async (event) => {
  try {
    const { address, wei } = (await event.req.json()) as FundBody;
    if (!address || !wei) {
      return jsonError("address and wei are required", 400);
    }

    const addWei = BigInt(wei);
    const balanceResponse = await fetch(DEV_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"],
      }),
    });
    const balanceJson = (await balanceResponse.json()) as { result?: string };
    const currentWei = BigInt(balanceJson.result ?? "0x0");

    const response = await fetch(DEV_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "anvil_setBalance",
        params: [address, `0x${(currentWei + addWei).toString(16)}`],
      }),
    });
    const json = (await response.json()) as { error?: { message: string } };
    if (json.error) throw new Error(json.error.message);

    return { ok: true };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error));
  }
});
