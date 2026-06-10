import process from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(fileURLToPath(import.meta.url), "../../..");

export const ANVIL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

/** ML-DSA test seed (shared with ZKNox pythonref vectors). */
export const PQ_TEST_SEED = "cafecafecafecafecafecafecafecafecafecafecafecafecafecafecafecafe";

export const CONTRACTS_DIR = join(packageRoot, "contracts");

export const MAINNET_FORK_URL =
  process.env.MAINNET_RPC_URL ?? "https://ethereum-rpc.publicnode.com";

export const ANVIL_BINARY = process.env.ANVIL_BINARY ?? join(homedir(), ".foundry", "bin", "anvil");
