import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { DEV_RPC_URL } from "./devConstants";

let bundlerKey: Hex | undefined;

/** Ephemeral dev-only gas payer — never stored in .env or sent to the browser. */
export function getDevBundlerKey(): Hex {
  bundlerKey ??= generatePrivateKey();
  return bundlerKey;
}

export async function fundDevBundler(): Promise<Address> {
  const account = privateKeyToAccount(getDevBundlerKey());
  const wei = (10n ** 21n).toString(16);
  const response = await fetch(DEV_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "anvil_setBalance",
      params: [account.address, `0x${wei}`],
    }),
  });
  const json = (await response.json()) as { error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return account.address;
}
