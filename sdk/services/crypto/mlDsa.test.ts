import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { describe, expect, it } from "vite-plus/test";
import { bytesToHex, hexToBytes } from "viem";
import { ML_DSA_SIGNATURE_BYTES } from "../../config/aa";
import { PQ_TEST_SEED } from "../../e2e/constants";
import { MlDsaPqKeyService } from "./MlDsaPqKeyService";
import { preparePublicKeyFromSeed } from "./mlDsaDeployment";

const EXPECTED_SIG_PREFIX = "eb2404980edf326a2a5a2fb2fb7414717d250934d84b4b5bbb546e5796a76a2d";

describe("ML-DSA-44 (@noble/post-quantum)", () => {
  it("prepares deployment public key for test seed", () => {
    const seed = hexToBytes(`0x${PQ_TEST_SEED}`);
    const publicKeyHex = preparePublicKeyFromSeed(seed);
    expect(publicKeyHex.startsWith("0x")).toBe(true);
    expect(hexToBytes(publicKeyHex).length).toBeGreaterThan(0);
  });

  it("signs and verifies userOp hash for test seed", () => {
    const seed = hexToBytes(`0x${PQ_TEST_SEED}`);
    const msg = hexToBytes(userOpHashFromCd());
    const { publicKey, secretKey } = ml_dsa44.keygen(seed);
    const sig = ml_dsa44.sign(msg, secretKey, { extraEntropy: false });
    expect(bytesToHex(sig).slice(2).startsWith(EXPECTED_SIG_PREFIX)).toBe(true);
    expect(sig.length).toBe(2420);
    expect(ml_dsa44.verify(sig, msg, publicKey)).toBe(true);
  });
});

describe("MlDsaPqKeyService", () => {
  const pq = new MlDsaPqKeyService();

  it("generates a 32-byte seed and deployment public key", async () => {
    const pair = await pq.generateKeyPair();
    expect(hexToBytes(pair.secretHex).length).toBe(32);
    expect(pair.publicKeyHex).toBe(preparePublicKeyFromSeed(hexToBytes(pair.secretHex)));
  });

  it("signs userOp hash with expected length and prefix", async () => {
    const secretHex = `0x${PQ_TEST_SEED}` as const;
    const signature = await pq.signUserOperationHash(secretHex, userOpHashFromCd());
    expect(hexToBytes(signature).length).toBe(ML_DSA_SIGNATURE_BYTES);
    expect(signature.replace(/^0x/, "").startsWith(EXPECTED_SIG_PREFIX)).toBe(true);
  });
});

function userOpHashFromCd(): `0x${string}` {
  return `0x${"cd".repeat(32)}` as const;
}
