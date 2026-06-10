import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployContract, waitForTransactionReceipt } from "viem/actions";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = join(packageRoot, "contracts");

const ANVIL_CHAIN = {
  id: 31_337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
};

function loadArtifact(relativePath) {
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

export async function deployLocalAaStack({ rpcUrl, deployerPrivateKey }) {
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: ANVIL_CHAIN, transport });
  const account = privateKeyToAccount(deployerPrivateKey);
  const walletClient = createWalletClient({ account, chain: ANVIL_CHAIN, transport });

  const entryPointArtifact = loadArtifact("EntryPoint.sol/EntryPoint.json");
  const verifierArtifact = loadArtifact("ZKNOX_dilithium.sol/ZKNOX_dilithium.json");
  const factoryArtifact = loadArtifact("PqSimpleAccountFactory.sol/PqSimpleAccountFactory.json");

  const entryPoint = await deployAndWait({
    publicClient,
    walletClient,
    abi: entryPointArtifact.abi,
    bytecode: entryPointArtifact.bytecode.object,
  });

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
    args: [entryPoint, verifier],
  });

  return { entryPoint, verifier, factory, chainId: ANVIL_CHAIN.id };
}
