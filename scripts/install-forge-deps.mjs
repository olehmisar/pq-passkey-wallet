import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const contractsDir = join(import.meta.dirname, "..", "contracts");
const forgeBin = join(homedir(), ".foundry", "bin", "forge");

function forgeEnv() {
  return { ...process.env, PATH: `${join(homedir(), ".foundry", "bin")}:${process.env.PATH}` };
}

function runForge(args, cwd = contractsDir) {
  const result = spawnSync(forgeBin, args, {
    cwd,
    stdio: "inherit",
    env: forgeEnv(),
  });
  if (result.status !== 0) {
    throw new Error(`forge ${args.join(" ")} failed`);
  }
}

/** Always pass --no-git — lib/ is gitignored and must not be registered as submodules. */
function forgeInstall(args, cwd = contractsDir) {
  runForge(["install", "--no-git", ...args], cwd);
}

function installIfMissing(cwd, label, spec) {
  const libName = spec.includes("=") ? spec.split("=")[0] : spec.split("/").pop();
  const target = join(cwd, "lib", libName);
  if (existsSync(target)) {
    console.log(`[forge:deps] ${label} already present`);
    return;
  }
  console.log(`[forge:deps] installing ${label}…`);
  forgeInstall(["--shallow", spec], cwd);
}

if (existsSync(join(contractsDir, "foundry.lock"))) {
  console.log("[forge:deps] syncing foundry.lock…");
  forgeInstall(["--shallow"]);
}

const deps = [
  { label: "forge-std", spec: "foundry-rs/forge-std" },
  { label: "account-abstraction", spec: "eth-infinitism/account-abstraction" },
  { label: "openzeppelin-contracts", spec: "OpenZeppelin/openzeppelin-contracts" },
  // ZKNox repo ships both ZKNOX_dilithium (FIPS-204) and ZKNOX_ethdilithium (Keccak); we use only the former.
  { label: "ETHDILITHIUM", spec: "ZKNoxHQ/ETHDILITHIUM" },
];

for (const dep of deps) {
  installIfMissing(contractsDir, dep.label, dep.spec);
}

const ethDir = join(contractsDir, "lib/ETHDILITHIUM");
installIfMissing(
  ethDir,
  "ETHDILITHIUM/InterfaceVerifier",
  "InterfaceVerifier=ZKNoxHQ/InterfaceVerifier",
);
installIfMissing(ethDir, "ETHDILITHIUM/sstore2", "sstore2=0xsequence/sstore2");

function ensurePolyntt() {
  const target = join(contractsDir, "lib/polyntt");
  if (existsSync(join(target, "__init__.py"))) {
    console.log("[forge:deps] polyntt already present");
    return;
  }
  const cacheDir = join(contractsDir, ".cache");
  const cloneDir = join(cacheDir, "NTT");
  mkdirSync(cacheDir, { recursive: true });
  if (!existsSync(cloneDir)) {
    console.log("[forge:deps] cloning ZKNoxHQ/NTT for polyntt…");
    const result = spawnSync(
      "git",
      ["clone", "--depth", "1", "https://github.com/ZKNoxHQ/NTT.git", cloneDir],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error("git clone ZKNoxHQ/NTT failed");
    }
  }
  const src = join(cloneDir, "assets/pythonref/polyntt");
  console.log("[forge:deps] installing polyntt…");
  cpSync(src, target, { recursive: true });
}

ensurePolyntt();

console.log("[forge:deps] done");
