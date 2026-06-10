import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { deployLocalAaStack } from "./deploy-local.mjs";

/** Must match `server/lib/devDeployer.ts` — Anvil account #0, dev-only. */
const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ANVIL_BINARY = process.env.ANVIL_BINARY ?? join(homedir(), ".foundry", "bin", "anvil");
const RPC_URL = "http://127.0.0.1:8545";

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function waitForRpc(maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await rpc("eth_chainId");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Anvil RPC did not become ready in time");
}

function startDetachedAnvil() {
  const child = spawn(
    ANVIL_BINARY,
    ["--host", "127.0.0.1", "--port", "8545", "--chain-id", "31337"],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, FOUNDRY_DISABLE_NIGHTLY_WARNING: "true" },
    },
  );
  child.unref();
}

function writeEnvLocal(deployment) {
  const lines = [
    `VITE_RPC_URL=${RPC_URL}`,
    `VITE_CHAIN_ID=${deployment.chainId}`,
    `VITE_ENTRY_POINT_ADDRESS=${deployment.entryPoint}`,
    `VITE_ML_DSA_VERIFIER=${deployment.verifier}`,
    `VITE_PQ_ACCOUNT_FACTORY=${deployment.factory}`,
  ];
  writeFileSync(join(process.cwd(), ".env.local"), `${lines.join("\n")}\n`);
}

function readExistingFactory() {
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const match = env.match(/^VITE_PQ_ACCOUNT_FACTORY=(0x[a-fA-F0-9]+)/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

async function main() {
  let running = false;
  try {
    await rpc("eth_chainId");
    running = true;
  } catch {
    running = false;
  }

  if (!running) {
    console.log("[dev-stack] starting Anvil…");
    startDetachedAnvil();
    await waitForRpc();
  }

  const existingFactory = readExistingFactory();
  if (existingFactory) {
    const code = await rpc("eth_getCode", [existingFactory, "latest"]);
    if (code && code !== "0x") {
      console.log(`[dev-stack] reusing factory ${existingFactory}`);
      return;
    }
  }

  console.log("[dev-stack] deploying AA stack…");
  const deployment = await deployLocalAaStack({
    rpcUrl: RPC_URL,
    deployerPrivateKey: DEPLOYER_PRIVATE_KEY,
  });
  writeEnvLocal(deployment);
  console.log(`[dev-stack] factory ${deployment.factory}`);
  console.log("[dev-stack] wrote .env.local");
}

main().catch((error) => {
  console.error("[dev-stack]", error);
  process.exit(1);
});
