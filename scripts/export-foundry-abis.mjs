import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(packageRoot, "contracts", "out");
const generatedDir = join(packageRoot, "sdk", "contracts", "generated");

const ARTIFACTS = [
  { file: "PqSimpleAccount.sol/PqSimpleAccount.json", export: "pqSimpleAccountAbi" },
  {
    file: "PqSimpleAccountFactory.sol/PqSimpleAccountFactory.json",
    export: "pqSimpleAccountFactoryAbi",
  },
  { file: "ZKNOX_dilithium.sol/ZKNOX_dilithium.json", export: "mlDsaVerifierAbi" },
];

mkdirSync(generatedDir, { recursive: true });

const lines = [
  "/** Auto-generated from Foundry artifacts — do not edit. Run `vp run forge:build`. */",
  "",
];

for (const { file, export: exportName } of ARTIFACTS) {
  const artifactPath = join(outDir, file);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  if (!artifact.abi) {
    throw new Error(`Missing abi in ${artifactPath}`);
  }
  lines.push(`export const ${exportName} = ${JSON.stringify(artifact.abi, null, 2)} as const;`);
  lines.push("");
}

writeFileSync(join(generatedDir, "abis.ts"), `${lines.join("\n")}\n`);
console.log(
  `[forge:export-abis] wrote ${ARTIFACTS.length} ABIs to sdk/contracts/generated/abis.ts`,
);
