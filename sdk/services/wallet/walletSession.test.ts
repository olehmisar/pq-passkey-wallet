import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { WalletSessionService } from "./WalletSessionService";

describe("WalletSessionService", () => {
  const memory = new Map<string, string>();
  const session = new WalletSessionService();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    session.clear();
  });

  it("round-trips public session metadata without PQ secret", () => {
    const record = {
      credential: { id: "cred-1", rpId: "localhost" },
      blob: {
        version: 1 as const,
        userId: "550e8400-e29b-41d4-a716-446655440000",
        pqPublicKeyHex: "0xabcd" as const,
        pqSecretHex: "0xsecret" as const,
        pkPointer: "0x0000000000000000000000000000000000000001" as const,
        accountAddress: "0x00000000000000000000000000000000000000aa" as const,
        accountSalt: "0",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    };

    session.persist(record, "Test Wallet");
    const restored = session.restore();
    expect(restored?.displayName).toBe("Test Wallet");
    expect(restored?.record.blob.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(restored?.record.blob.pqSecretHex).toBeUndefined();
    expect(session.stripPublic(record).blob.pqSecretHex).toBeUndefined();

    session.clear();
    expect(session.restore()).toBeNull();
  });
});
