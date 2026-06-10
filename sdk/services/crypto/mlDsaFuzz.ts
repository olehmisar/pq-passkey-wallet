import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import type { Hex } from "viem";
import { bytesToHex } from "viem";
import { PQ_TEST_SEED } from "../../e2e/constants";

export const OFFCHAIN_FUZZ_ROUNDS = 48;
export const ONCHAIN_FUZZ_ROUNDS = 8;

/** Reproducible 32-byte seeds: round 0 is the shared ZKNox/pythonref test vector. */
export function fuzzSeed(round: number): Uint8Array {
  if (round === 0) {
    return hexToBytesStrict(`0x${PQ_TEST_SEED}`);
  }
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = (round * 131 + i * 17 + (round >> 8)) & 0xff;
  }
  return seed;
}

export function randomFuzzSeed(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function fuzzMessage(round: number): Uint8Array {
  const msg = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    msg[i] = (round * 59 + i * 23 + 0xcd) & 0xff;
  }
  return msg;
}

export function randomMessageHash(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function signMlDsa44(seed: Uint8Array, message: Uint8Array): Uint8Array {
  const { secretKey } = ml_dsa44.keygen(seed);
  return ml_dsa44.sign(message, secretKey, { extraEntropy: false });
}

function hexToBytesStrict(hex: Hex): Uint8Array {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
