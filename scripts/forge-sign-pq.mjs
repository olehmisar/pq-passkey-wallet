#!/usr/bin/env node
/**
 * Signs a 32-byte userOp hash with PQ_TEST_SEED for Foundry FFI tests.
 * Usage: node scripts/forge-sign-pq.mjs 0x<64-hex-char-hash>
 * Writes hex-encoded signature (UTF-8) to stdout for `vm.ffi`.
 */
import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { hexToBytes } from "viem";

const PQ_TEST_SEED = "cafecafecafecafecafecafecafecafecafecafecafecafecafecafecafecafe";

const hashArg = process.argv[2];
if (!hashArg?.startsWith("0x") || hashArg.length !== 66) {
  process.stderr.write("usage: node scripts/forge-sign-pq.mjs 0x<32-byte-hash>\n");
  process.exit(1);
}

const seed = hexToBytes(`0x${PQ_TEST_SEED}`);
const hash = hexToBytes(hashArg);
const { secretKey } = ml_dsa44.keygen(seed);
const sig = ml_dsa44.sign(hash, secretKey, { extraEntropy: false });
process.stdout.write(Buffer.from(sig).toString("hex"));
