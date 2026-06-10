import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Abi, Address, Client, Hex, WalletClient } from "viem";
import { deployContract, waitForTransactionReceipt } from "viem/actions";
import { CONTRACTS_DIR } from "./constants";

type ForgeArtifact = {
  abi: readonly unknown[];
  bytecode: { object: Hex };
};

export type LocalDeployment = {
  entryPoint: Address;
  verifier: Address;
  factory: Address;
};

function loadArtifact(relativePath: string): ForgeArtifact {
  const raw = readFileSync(join(CONTRACTS_DIR, "out", relativePath), "utf8");
  return JSON.parse(raw) as ForgeArtifact;
}

async function deployAndWait(params: {
  publicClient: Client;
  walletClient: WalletClient;
  abi: ForgeArtifact["abi"];
  bytecode: Hex;
  args?: readonly unknown[];
}): Promise<Address> {
  const hash = await deployContract(params.walletClient, {
    abi: params.abi as Abi,
    bytecode: params.bytecode,
    args: params.args,
  } as Parameters<typeof deployContract>[1]);
  const receipt = await waitForTransactionReceipt(params.publicClient, { hash });
  if (!receipt.contractAddress) {
    throw new Error(`Deployment tx ${hash} did not create a contract`);
  }
  return receipt.contractAddress;
}

export async function deployLocalAaStack(params: {
  publicClient: Client;
  walletClient: WalletClient;
}): Promise<LocalDeployment> {
  const entryPointArtifact = loadArtifact("EntryPoint.sol/EntryPoint.json");
  const verifierArtifact = loadArtifact("ZKNOX_dilithium.sol/ZKNOX_dilithium.json");
  const factoryArtifact = loadArtifact("PqSimpleAccountFactory.sol/PqSimpleAccountFactory.json");

  const entryPoint = await deployAndWait({
    ...params,
    abi: entryPointArtifact.abi,
    bytecode: entryPointArtifact.bytecode.object,
  });

  const verifier = await deployAndWait({
    ...params,
    abi: verifierArtifact.abi,
    bytecode: verifierArtifact.bytecode.object,
  });

  const factory = await deployAndWait({
    ...params,
    abi: factoryArtifact.abi,
    bytecode: factoryArtifact.bytecode.object,
    args: [entryPoint, verifier],
  });

  return { entryPoint, verifier, factory };
}
