import { describe, expect, it } from "vite-plus/test";
import { hexToBytes } from "viem";
import { ML_DSA_SIGNATURE_BYTES } from "./config/aa";
import { PQ_TEST_SEED } from "./e2e/constants";
import { MlDsaPqKeyService } from "./services/crypto/MlDsaPqKeyService";

const EXPECTED_SIG_PREFIX = "eb2404980edf326a2a5a2fb2fb7414717d250934d84b4b5bbb546e5796a76a2d";

describe("MlDsaPqKeyService", () => {
  const pq = new MlDsaPqKeyService();

  it("generates a 32-byte seed and deployment public key", async () => {
    const pair = await pq.generateKeyPair();
    expect(hexToBytes(pair.secretHex).length).toBe(32);
    expect(pair.publicKeyHex.startsWith("0x")).toBe(true);
    expect(hexToBytes(pair.publicKeyHex).length).toBeGreaterThan(0);
  });

  it("signs userOp hash with ML-DSA test vector prefix", async () => {
    const secretHex = `0x${PQ_TEST_SEED}` as const;
    const userOpHash = `0x${"cd".repeat(32)}` as const;
    const signature = await pq.signUserOperationHash(secretHex, userOpHash);
    expect(signature.replace(/^0x/, "").startsWith(EXPECTED_SIG_PREFIX)).toBe(true);
    expect(hexToBytes(signature).length).toBe(ML_DSA_SIGNATURE_BYTES);
  });
});
