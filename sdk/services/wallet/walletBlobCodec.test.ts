import { describe, expect, it } from "vite-plus/test";
import { hexToBytes } from "viem";
import { preparePublicKeyFromSeed } from "../crypto/mlDsaDeployment";
import { deserializePasskeyWalletBlob, serializePasskeyWalletBlob } from "./walletBlobCodec";

describe("walletBlobCodec", () => {
  it("stores a slim passkey blob that fits largeBlob limits", () => {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const secretHex =
      `0x${[...seed].map((b) => b.toString(16).padStart(2, "0")).join("")}` as const;
    const bytes = serializePasskeyWalletBlob({
      version: 1,
      userId: "550e8400-e29b-41d4-a716-446655440000",
      pqSecretHex: secretHex,
      pqPublicKeyHex: preparePublicKeyFromSeed(seed),
      pkPointer: "0x0000000000000000000000000000000000000001",
      accountAddress: "0x00000000000000000000000000000000000000aa",
      accountSalt: "0",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    expect(bytes.length).toBeLessThan(2048);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    expect(parsed.pqPublicKeyHex).toBeUndefined();
    expect(parsed.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(parsed.pqSecretHex).toBe(secretHex);
  });

  it("hydrates the deployment public key from the stored seed", () => {
    const seed = hexToBytes(`0x${"11".repeat(32)}`);
    const secretHex = `0x${"11".repeat(32)}` as const;
    const bytes = serializePasskeyWalletBlob({
      version: 1,
      pqSecretHex: secretHex,
      pqPublicKeyHex: preparePublicKeyFromSeed(seed),
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const restored = deserializePasskeyWalletBlob(bytes);
    expect(restored.pqPublicKeyHex).toBe(preparePublicKeyFromSeed(seed));
    expect(restored.pqSecretHex).toBe(secretHex);
  });
});
