import type { Address, Hex } from "viem";
import type { PasskeyCredentialRef, WalletBlobV1, WalletRecord } from "./PasskeyPqWalletService";

const STORAGE_KEY = "pq-passkey-wallet/session/v1";

/** Public wallet session — no PQ secret (passkey unlock on first sign). */
type StoredWalletSession = {
  version: 1;
  displayName: string;
  userId?: string;
  credential: PasskeyCredentialRef;
  accountAddress: Address;
  pqPublicKeyHex: Hex;
  pkPointer?: Address;
  accountSalt?: string;
  createdAt: string;
};

export class WalletSessionService {
  restore(): { record: WalletRecord; displayName: string } | null {
    const stored = this.load();
    if (!stored) return null;
    return { record: this.toRecord(stored), displayName: stored.displayName };
  }

  persist(record: WalletRecord, displayName: string): void {
    this.save(this.fromRecord(record, displayName));
  }

  clear(): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  }

  stripPublic(record: WalletRecord): WalletRecord {
    const { pqSecretHex: _secret, ...publicBlob } = record.blob;
    return { credential: record.credential, blob: publicBlob as WalletBlobV1 };
  }

  private load(): StoredWalletSession | null {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredWalletSession;
      if (parsed.version !== 1 || !parsed.accountAddress || !parsed.credential?.id) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private save(session: StoredWalletSession): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private toRecord(stored: StoredWalletSession): WalletRecord {
    return {
      credential: stored.credential,
      blob: {
        version: 1,
        userId: stored.userId,
        pqPublicKeyHex: stored.pqPublicKeyHex,
        pkPointer: stored.pkPointer,
        accountAddress: stored.accountAddress,
        accountSalt: stored.accountSalt,
        createdAt: stored.createdAt,
      },
    };
  }

  private fromRecord(record: WalletRecord, displayName: string): StoredWalletSession {
    const address = record.blob.accountAddress;
    if (!address) {
      throw new Error("Cannot persist session without smart-account address");
    }
    return {
      version: 1,
      displayName,
      userId: record.blob.userId,
      credential: record.credential,
      accountAddress: address,
      pqPublicKeyHex: record.blob.pqPublicKeyHex,
      pkPointer: record.blob.pkPointer,
      accountSalt: record.blob.accountSalt,
      createdAt: record.blob.createdAt,
    };
  }
}
