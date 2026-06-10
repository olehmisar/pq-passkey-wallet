import { Hex } from "ox";

/** largeBlob extension inputs for assertion (not in ox Types — WebAuthn L3). */
export type LargeBlobAssertionExtension = { read: true } | { write: ArrayBuffer };

export type LargeBlobClientExtensionResults = {
  largeBlob?: { blob?: ArrayBuffer; written?: boolean; supported?: boolean };
};

export function rpIdOrDefault(rpId?: string): string {
  return rpId ?? window.location.hostname;
}

export function randomWebAuthnChallenge(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Hex.fromBytes(bytes);
}

export function blobToArrayBuffer(blob: Uint8Array): ArrayBuffer {
  return blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength) as ArrayBuffer;
}
