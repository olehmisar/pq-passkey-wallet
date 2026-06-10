import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sepolia } from "viem/chains";
import { deployTestnetStack } from "./lib/deploy-testnet-stack.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = join(packageRoot, "contracts");

async function main() {
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ?? process.env.VITE_RPC_URL ?? sepolia.rpcUrls.default.http[0];

  const deployment = await deployTestnetStack({
    chain: sepolia,
    rpcUrl,
    contractsDir,
  });

  const outDir = join(packageRoot, "deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "ethereum-sepolia.json");
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log("[deploy:ethereum-sepolia]", JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error("[deploy:ethereum-sepolia]", error);
  process.exit(1);
});
