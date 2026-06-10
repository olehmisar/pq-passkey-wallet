import type { Hex } from "viem";

/** Anvil account #0 — dev-only gas payer for setKey; never exposed to the browser. */
export const DEV_DEPLOYER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const satisfies Hex;
