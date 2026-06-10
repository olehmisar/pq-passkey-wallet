import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import type { Hex } from "viem";
import { bytesToHex, hexToBytes } from "viem";
import { preparePublicKeyFromSeed } from "./mlDsaDeployment";

/** Post-quantum key material — FIPS-204 ML-DSA-44. */
export type PqKeyPair = {
  /** Deployment-encoded public key (hex) for `ZKNOX_dilithium.setKey`. */
  publicKeyHex: Hex;
  /** 32-byte seed (hex) — never persist outside largeBlob. */
  secretHex: Hex;
};

export type PqKeyServiceLike = {
  generateKeyPair(): Promise<PqKeyPair>;
  signUserOperationHash(
    secretHex: `0x${string}`,
    userOpHash: `0x${string}`,
  ): Promise<`0x${string}`>;
};

/** Self-custodial PQ keys: standard ML-DSA-44 via `@noble/post-quantum`. */
export class MlDsaPqKeyService implements PqKeyServiceLike {
  async generateKeyPair(): Promise<PqKeyPair> {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const secretHex = bytesToHex(seed);
    const publicKeyHex = preparePublicKeyFromSeed(seed);
    return { publicKeyHex, secretHex };
  }

  async signUserOperationHash(secretHex: Hex, userOpHash: Hex): Promise<Hex> {
    const seed = hexToBytes(secretHex);
    const msg = hexToBytes(userOpHash);
    const { secretKey } = ml_dsa44.keygen(seed);
    const sig = ml_dsa44.sign(msg, secretKey, { extraEntropy: false });
    return bytesToHex(sig);
  }
}
