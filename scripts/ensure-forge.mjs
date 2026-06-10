import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const forgeBin = join(homedir(), ".foundry", "bin", "forge");

function forgeEnv() {
  return { ...process.env, PATH: `${join(homedir(), ".foundry", "bin")}:${process.env.PATH}` };
}

function hasForge() {
  const r = spawnSync(forgeBin, ["--version"], { encoding: "utf8", env: forgeEnv() });
  if (r.status === 0) return true;
  const r2 = spawnSync("forge", ["--version"], { encoding: "utf8" });
  return r2.status === 0;
}

function installFoundry() {
  console.log("[forge:ensure] Foundry not found — installing via foundryup…");
  const install = spawnSync("bash", ["-lc", "curl -L https://foundry.paradigm.xyz | bash"], {
    stdio: "inherit",
  });
  if (install.status !== 0) {
    throw new Error("foundryup install failed");
  }
  const foundryup = spawnSync(
    "bash",
    ["-lc", 'export PATH="$HOME/.foundry/bin:$PATH" && foundryup'],
    {
      stdio: "inherit",
    },
  );
  if (foundryup.status !== 0) {
    throw new Error("foundryup failed");
  }
}

if (!hasForge()) {
  installFoundry();
  if (!hasForge()) {
    throw new Error(
      "forge still not on PATH after foundryup. Open a new shell or add ~/.foundry/bin to PATH.",
    );
  }
}

const version = spawnSync(forgeBin, ["--version"], { encoding: "utf8", env: forgeEnv() });
console.log("[forge:ensure] forge ready:", (version.stdout || version.stderr).trim());
