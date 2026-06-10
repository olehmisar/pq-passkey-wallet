/** Stable WebAuthn user handle for passkey ↔ wallet binding. */
export function createWalletUserId(): string {
  return crypto.randomUUID();
}

export function userIdToBytes(userId: string): Uint8Array {
  const hex = userId.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error(`wallet userId must be a UUID, got ${userId}`);
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
