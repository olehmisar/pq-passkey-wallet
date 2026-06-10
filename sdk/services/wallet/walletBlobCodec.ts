import type { Hex } from "viem";
import { hexToBytes } from "viem";
import { preparePublicKeyFromSeed } from "../crypto/mlDsaDeployment";
import type { WalletBlobV1 } from "./PasskeyPqWalletService";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** WebAuthn largeBlob is ~2KB — store the seed only, not the deployment public key (~45KB). */
type PasskeyStoredWalletBlobV1 = {
  version: 1;
  userId?: string;
  pqSecretHex: Hex;
  pkPointer?: WalletBlobV1["pkPointer"];
  accountAddress?: WalletBlobV1["accountAddress"];
  accountSalt?: string;
  createdAt: string;
};

export function serializePasskeyWalletBlob(blob: WalletBlobV1): Uint8Array {
  if (!blob.pqSecretHex) {
    throw new Error("Cannot store wallet in passkey without PQ secret");
  }
  const stored: PasskeyStoredWalletBlobV1 = {
    version: 1,
    userId: blob.userId,
    pqSecretHex: blob.pqSecretHex,
    pkPointer: blob.pkPointer,
    accountAddress: blob.accountAddress,
    accountSalt: blob.accountSalt,
    createdAt: blob.createdAt,
  };
  return textEncoder.encode(JSON.stringify(stored));
}

export function deserializePasskeyWalletBlob(bytes: Uint8Array): WalletBlobV1 {
  const parsed = JSON.parse(textDecoder.decode(bytes)) as Partial<WalletBlobV1>;
  if (parsed.version !== 1) {
    throw new Error(`Unsupported wallet blob version: ${String(parsed.version)}`);
  }
  if (!parsed.pqSecretHex) {
    throw new Error(
      "Wallet passkey data is incomplete — the PQ secret did not fit in largeBlob. Create a new wallet.",
    );
  }

  const pqPublicKeyHex =
    parsed.pqPublicKeyHex ?? preparePublicKeyFromSeed(hexToBytes(parsed.pqSecretHex));

  return {
    version: 1,
    userId: parsed.userId,
    pqPublicKeyHex,
    pqSecretHex: parsed.pqSecretHex,
    pkPointer: parsed.pkPointer,
    accountAddress: parsed.accountAddress,
    accountSalt: parsed.accountSalt,
    createdAt: parsed.createdAt ?? new Date(0).toISOString(),
  };
}
