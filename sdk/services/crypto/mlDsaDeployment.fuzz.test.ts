import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { encodePacked, type Hex } from "viem";
import { readContract } from "viem/actions";
import { mlDsaVerifierAbi } from "../../contracts/abis";
import { ML_DSA_SIGNATURE_BYTES } from "../../config/aa";
import { startLocalAnvil, stopAnvilHarness, type AnvilHarness } from "../../e2e/anvil";
import { ANVIL_PRIVATE_KEY } from "../../e2e/constants";
import { deployLocalAaStack } from "../../e2e/deployLocal";
import type { AppPublicClient } from "../../utils";
import { ViemAccountAbstractionService } from "../aa/AccountAbstractionService";
import {
  fuzzMessage,
  fuzzSeed,
  OFFCHAIN_FUZZ_ROUNDS,
  ONCHAIN_FUZZ_ROUNDS,
  randomFuzzSeed,
  randomMessageHash,
  signMlDsa44,
} from "./mlDsaFuzz";
import { preparePublicKeyFromPublicKey, preparePublicKeyFromSeed } from "./mlDsaDeployment";

const SIG_VERIFY_SELECTOR = "0x024ad318" as const;

describe("mlDsaDeployment fuzz (off-chain)", () => {
  it.each(Array.from({ length: OFFCHAIN_FUZZ_ROUNDS }, (_, round) => round))(
    "deployment expansion matches noble for seed round %i",
    (round) => {
      const seed = fuzzSeed(round);
      const { publicKey } = ml_dsa44.keygen(seed);
      const fromSeed = preparePublicKeyFromSeed(seed);
      const fromPk = preparePublicKeyFromPublicKey(publicKey);
      expect(fromSeed).toBe(fromPk);
      expect(preparePublicKeyFromSeed(seed)).toBe(fromSeed);
    },
  );

  it.each(Array.from({ length: OFFCHAIN_FUZZ_ROUNDS }, (_, round) => round))(
    "noble verifies signatures for deployment round %i",
    (round) => {
      const seed = fuzzSeed(round);
      const message = fuzzMessage(round);
      const { publicKey } = ml_dsa44.keygen(seed);
      const signature = signMlDsa44(seed, message);
      expect(signature.length).toBe(ML_DSA_SIGNATURE_BYTES);
      expect(ml_dsa44.verify(signature, message, publicKey)).toBe(true);
      preparePublicKeyFromPublicKey(publicKey);
    },
  );

  it("random seeds satisfy expansion + verify properties", () => {
    for (let i = 0; i < 16; i++) {
      const seed = randomFuzzSeed();
      const { publicKey } = ml_dsa44.keygen(seed);
      expect(preparePublicKeyFromSeed(seed)).toBe(preparePublicKeyFromPublicKey(publicKey));
      const msg = randomMessageHash();
      const msgBytes = hexToBytes32(msg);
      const signature = signMlDsa44(seed, msgBytes);
      expect(ml_dsa44.verify(signature, msgBytes, publicKey)).toBe(true);
    }
  });
});

describe("mlDsaDeployment fuzz (on-chain ZKNox verify)", () => {
  let harness: AnvilHarness;
  let verifier: Hex;
  let aaSvc: ViemAccountAbstractionService;

  beforeAll(async () => {
    harness = await startLocalAnvil();
    const deployment = await deployLocalAaStack({
      publicClient: harness.publicClient,
      walletClient: harness.deployerWalletClient,
    });
    verifier = deployment.verifier;
    aaSvc = new ViemAccountAbstractionService({
      publicClient: harness.publicClient as AppPublicClient,
      deployment: {
        chainId: harness.chain.id,
        rpcUrl: harness.rpcUrl,
        entryPointAddress: deployment.entryPoint,
        entryPointVersion: "0.9",
        pqAccountFactoryAddress: deployment.factory,
        mlDsaVerifierAddress: deployment.verifier,
        accountSalt: 0n,
      },
      deployerPrivateKey: ANVIL_PRIVATE_KEY,
    });
  }, 180_000);

  afterAll(async () => {
    if (harness) await stopAnvilHarness(harness);
  });

  it.each(Array.from({ length: ONCHAIN_FUZZ_ROUNDS }, (_, round) => round))(
    "ZKNOX_dilithium verifies noble sig for seed round %i",
    async (round) => {
      const seed = fuzzSeed(round);
      const message = fuzzMessage(round);
      const publicKeyHex = preparePublicKeyFromSeed(seed);
      const pkPointer = await aaSvc.registerPublicKey(publicKeyHex);
      const signature = signMlDsa44(seed, message);
      const msgHash = bytesToHex32(message);

      const result = await readContract(harness.publicClient, {
        address: verifier,
        abi: mlDsaVerifierAbi,
        functionName: "verify",
        args: [encodePacked(["address"], [pkPointer]), msgHash, bytesToHex32(signature)],
      });

      expect(result).toBe(SIG_VERIFY_SELECTOR);
    },
    120_000,
  );

  it("on-chain verify rejects a tampered message", async () => {
    const seed = fuzzSeed(1);
    const message = fuzzMessage(1);
    const publicKeyHex = preparePublicKeyFromSeed(seed);
    const pkPointer = await aaSvc.registerPublicKey(publicKeyHex);
    const signature = signMlDsa44(seed, message);
    const tampered = bytesToHex32(fuzzMessage(99));

    const result = await readContract(harness.publicClient, {
      address: verifier,
      abi: mlDsaVerifierAbi,
      functionName: "verify",
      args: [encodePacked(["address"], [pkPointer]), tampered, bytesToHex32(signature)],
    });

    expect(result).not.toBe(SIG_VERIFY_SELECTOR);
  }, 120_000);
});

function hexToBytes32(hex: Hex): Uint8Array {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex32(bytes: Uint8Array): Hex {
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}
