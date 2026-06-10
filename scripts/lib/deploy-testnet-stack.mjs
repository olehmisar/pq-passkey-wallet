import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { entryPoint09Address } from "viem/account-abstraction";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployContract, getBalance, waitForTransactionReceipt } from "viem/actions";

const ENTRY_POINT = entryPoint09Address;

/** Foundry keystore (`cast wallet new`) or raw `DEPLOYER_PRIVATE_KEY`. */
export function resolveDeployerPrivateKey() {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    return process.env.DEPLOYER_PRIVATE_KEY;
  }

  const account = process.env.ETH_KEYSTORE_ACCOUNT;
  const password = process.env.CAST_PASSWORD ?? process.env.CAST_UNSAFE_PASSWORD;
  if (!account || !password) {
    throw new Error(
      "Set DEPLOYER_PRIVATE_KEY or ETH_KEYSTORE_ACCOUNT + CAST_PASSWORD (from cast wallet new)",
    );
  }

  const output = execSync(
    `cast wallet decrypt-keystore ${account} --unsafe-password ${JSON.stringify(password)}`,
    { encoding: "utf8" },
  ).trim();

  const match = output.match(/0x[a-fA-F0-9]{64}/);
  if (!match) {
    throw new Error("Could not parse private key from cast decrypt-keystore output");
  }
  return match[0];
}

function loadArtifact(contractsDir, relativePath) {
  const raw = readFileSync(join(contractsDir, "out", relativePath), "utf8");
  return JSON.parse(raw);
}

async function deployAndWait({ publicClient, walletClient, abi, bytecode, args = [] }) {
  const hash = await deployContract(walletClient, { abi, bytecode, args });
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (!receipt.contractAddress) {
    throw new Error(`Deployment tx ${hash} did not create a contract`);
  }
  return receipt.contractAddress;
}

export async function deployTestnetStack({ chain, rpcUrl, contractsDir }) {
  const deployerPrivateKey = resolveDeployerPrivateKey();
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = privateKeyToAccount(deployerPrivateKey);
  const walletClient = createWalletClient({ account, chain, transport });

  const balance = await getBalance(publicClient, { address: account.address });
  if (balance === 0n) {
    throw new Error(
      `Deployer ${account.address} has 0 ETH on ${chain.name} — fund it before deploying`,
    );
  }

  const verifierArtifact = loadArtifact(contractsDir, "ZKNOX_dilithium.sol/ZKNOX_dilithium.json");
  const factoryArtifact = loadArtifact(
    contractsDir,
    "PqSimpleAccountFactory.sol/PqSimpleAccountFactory.json",
  );

  const verifier = await deployAndWait({
    publicClient,
    walletClient,
    abi: verifierArtifact.abi,
    bytecode: verifierArtifact.bytecode.object,
  });

  const factory = await deployAndWait({
    publicClient,
    walletClient,
    abi: factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode.object,
    args: [ENTRY_POINT, verifier],
  });

  return {
    chainId: chain.id,
    entryPoint: ENTRY_POINT,
    verifier,
    factory,
    rpcUrl,
    deployer: account.address,
  };
}
