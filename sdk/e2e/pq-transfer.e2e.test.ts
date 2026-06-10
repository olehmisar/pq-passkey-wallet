import { describe, expect, it, beforeAll, afterAll } from "vite-plus/test";
import { hexToBytes, parseEther } from "viem";
import { normalize } from "viem/ens";
import { getBytecode, getEnsAddress, getBalance } from "viem/actions";
import { mainnet } from "viem/chains";
import { createSdk } from "../index";
import { DirectUserOperationService } from "../services/aa/DirectUserOperationService";
import { toPqSimpleSmartAccount } from "../services/aa/toPqSimpleSmartAccount";
import { startMainnetForkAnvil, stopAnvilHarness, type AnvilHarness } from "./anvil";
import { ANVIL_PRIVATE_KEY, PQ_TEST_SEED } from "./constants";
import { deployLocalAaStack } from "./deployLocal";
import { preparePublicKeyFromSeed } from "../services/crypto/mlDsaDeployment";
import { MlDsaPqKeyService } from "../services/crypto/MlDsaPqKeyService";

const pqKey = new MlDsaPqKeyService();

describe("pq smart-account e2e (anvil fork)", () => {
  let harness: AnvilHarness;

  beforeAll(async () => {
    harness = await startMainnetForkAnvil();
  }, 180_000);

  afterAll(async () => {
    if (harness) await stopAnvilHarness(harness);
  });

  it("creates a PQ account via factory, funds it, and sends ETH to vitalik.eth", async () => {
    const { publicClient, deployerWalletClient, bundlerWalletClient, bundlerAccount } = harness;
    const deployment = await deployLocalAaStack({
      publicClient,
      walletClient: deployerWalletClient,
    });

    const sdk = createSdk({
      rpcUrl: harness.rpcUrl,
      chainId: mainnet.id,
      deployerPrivateKey: ANVIL_PRIVATE_KEY,
      aa: {
        rpcUrl: harness.rpcUrl,
        chainId: mainnet.id,
        entryPointAddress: deployment.entryPoint,
        entryPointVersion: "0.9",
        pqAccountFactoryAddress: deployment.factory,
        mlDsaVerifierAddress: deployment.verifier,
        accountSalt: 0n,
      },
    });

    const publicKeyHex = preparePublicKeyFromSeed(hexToBytes(`0x${PQ_TEST_SEED}`));
    const pkPointer = await sdk.aa.registerPublicKey(publicKeyHex);
    const accountAddress = await sdk.aa.getCounterfactualAddress(pkPointer);

    const smartAccount = await toPqSimpleSmartAccount({
      client: sdk.publicClient,
      deployment: sdk.aaConfig,
      pkPointer,
      address: accountAddress,
      signer: {
        signUserOperationHash: (userOpHash) =>
          pqKey.signUserOperationHash(`0x${PQ_TEST_SEED}`, userOpHash),
      },
    });

    await harness.testClient.setBalance({
      address: accountAddress,
      value: parseEther("1"),
    });

    const vitalik = await getEnsAddress(harness.publicClient, {
      name: normalize("vitalik.eth"),
    });
    expect(vitalik).toBeTruthy();

    const transferValue = parseEther("0.01");
    const balanceBefore = await getBalance(harness.publicClient, { address: vitalik! });

    await new DirectUserOperationService(publicClient).submit({
      entryPoint: deployment.entryPoint,
      verifier: deployment.verifier,
      walletClient: bundlerWalletClient,
      account: smartAccount,
      pkPointer,
      beneficiary: bundlerAccount.address,
      calls: [{ to: vitalik!, value: transferValue }],
    });

    const code = await getBytecode(harness.publicClient, { address: accountAddress });
    expect(code).toBeTruthy();
    expect(code).not.toBe("0x");

    const balanceAfter = await getBalance(harness.publicClient, { address: vitalik! });
    expect(balanceAfter - balanceBefore).toBe(transferValue);
  }, 300_000);
});
