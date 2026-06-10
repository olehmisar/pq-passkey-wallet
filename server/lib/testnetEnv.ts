import process from "node:process";
import type { Hex } from "viem";
import { sepolia } from "viem/chains";

export function requireFunderPrivateKey(): Hex {
  const key = process.env.FUNDER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    throw new Error("FUNDER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required on the server");
  }
  return key as Hex;
}

export function testnetRpcUrl(): string {
  return process.env.SEPOLIA_RPC_URL ?? process.env.VITE_RPC_URL ?? sepolia.rpcUrls.default.http[0];
}

export function testnetChainId(): number {
  return Number(process.env.VITE_CHAIN_ID ?? sepolia.id);
}

export function testnetEntryPointAddress(): `0x${string}` {
  const address = process.env.VITE_ENTRY_POINT_ADDRESS;
  if (!address) {
    throw new Error("VITE_ENTRY_POINT_ADDRESS is required on the server");
  }
  return address as `0x${string}`;
}
