import { XOF128 } from "@noble/post-quantum/_crystals.js";
import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { shake256 } from "@noble/hashes/sha3.js";
import type { Hex } from "viem";
import { bytesToHex, encodeAbiParameters } from "viem";

const Q = 8380417;
const N = 256;
const D = 13;
const K = 4;
const L = 4;
const TR_BYTES = 64;

const PSI_REV: readonly number[] = [
  1, 4808194, 3765607, 3761513, 5178923, 5496691, 5234739, 5178987, 7778734, 3542485, 2682288,
  2129892, 3764867, 7375178, 557458, 7159240, 5010068, 4317364, 2663378, 6705802, 4855975, 7946292,
  676590, 7044481, 5152541, 1714295, 2453983, 1460718, 7737789, 4795319, 2815639, 2283733, 3602218,
  3182878, 2740543, 4793971, 5269599, 2101410, 3704823, 1159875, 394148, 928749, 1095468, 4874037,
  2071829, 4361428, 3241972, 2156050, 3415069, 1759347, 7562881, 4805951, 3756790, 6444618, 6663429,
  4430364, 5483103, 3192354, 556856, 3870317, 2917338, 1853806, 3345963, 1858416, 3073009, 1277625,
  5744944, 3852015, 4183372, 5157610, 5258977, 8106357, 2508980, 2028118, 1937570, 4564692, 2811291,
  5396636, 7270901, 4158088, 1528066, 482649, 1148858, 5418153, 7814814, 169688, 2462444, 5046034,
  4213992, 4892034, 1987814, 5183169, 1736313, 235407, 5130263, 3258457, 5801164, 1787943, 5989328,
  6125690, 3482206, 4197502, 7080401, 6018354, 7062739, 2461387, 3035980, 621164, 3901472, 7153756,
  2925816, 3374250, 1356448, 5604662, 2683270, 5601629, 4912752, 2312838, 7727142, 7921254, 348812,
  8052569, 1011223, 6026202, 4561790, 6458164, 6143691, 1744507, 1753, 6444997, 5720892, 6924527,
  2660408, 6600190, 8321269, 2772600, 1182243, 87208, 636927, 4415111, 4423672, 6084020, 5095502,
  4663471, 8352605, 822541, 1009365, 5926272, 6400920, 1596822, 4423473, 4620952, 6695264, 4969849,
  2678278, 4611469, 4829411, 635956, 8129971, 5925040, 4234153, 6607829, 2192938, 6653329, 2387513,
  4768667, 8111961, 5199961, 3747250, 2296099, 1239911, 4541938, 3195676, 2642980, 1254190, 8368000,
  2998219, 141835, 8291116, 2513018, 7025525, 613238, 7070156, 6161950, 7921677, 6458423, 4040196,
  4908348, 2039144, 6500539, 7561656, 6201452, 6757063, 2105286, 6006015, 6346610, 586241, 7200804,
  527981, 5637006, 6903432, 1994046, 2491325, 6987258, 507927, 7192532, 7655613, 6545891, 5346675,
  8041997, 2647994, 3009748, 5767564, 4148469, 749577, 4357667, 3980599, 2569011, 6764887, 1723229,
  1665318, 2028038, 1163598, 5011144, 3994671, 8368538, 7009900, 3020393, 3363542, 214880, 545376,
  7609976, 3105558, 7277073, 508145, 7826699, 860144, 3430436, 140244, 6866265, 6195333, 3123762,
  2358373, 6187330, 5365997, 6663603, 2926054, 7987710, 8077412, 3531229, 4405932, 4606686, 1900052,
  7598542, 1054478, 7648983,
];
function modQ(x: number): number {
  const r = x % Q;
  return r < 0 ? r + Q : r;
}

function intFromBytesLE(bytes: Uint8Array): bigint {
  let r = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    r = (r << 8n) | BigInt(bytes[i]!);
  }
  return r;
}

function bitUnpack(input: Uint8Array, nBits: number): number[] {
  const r = intFromBytesLE(input);
  const mask = (1n << BigInt(nBits)) - 1n;
  const coeffs: number[] = [];
  for (let i = 0; i < N; i++) coeffs.push(Number((r >> BigInt(nBits * i)) & mask));
  return coeffs;
}

function ntt(coeffs: number[]): number[] {
  const a = [...coeffs];
  let t = N;
  let m = 1;
  while (m < N) {
    t >>= 1;
    for (let i = 0; i < m; i++) {
      const j1 = 2 * i * t;
      const j2 = j1 + t - 1;
      const S = PSI_REV[m + i]!;
      for (let j = j1; j <= j2; j++) {
        const U = a[j]!;
        const V = modQ(a[j + t]! * S);
        a[j] = modQ(U + V);
        a[j + t] = modQ(U - V);
      }
    }
    m <<= 1;
  }
  return a;
}

type Poly = { coeffs: number[]; ntt: boolean };
type Mat = Poly[][];

function poly(coeffs: number[], isNtt = false): Poly {
  const c = [...coeffs];
  while (c.length < N) c.push(0);
  if (c.length > N) throw new Error("poly too long");
  return { coeffs: c, ntt: isNtt };
}

function polyToNtt(p: Poly): Poly {
  if (p.ntt) return p;
  return { coeffs: ntt(p.coeffs), ntt: true };
}

function polyScale(p: Poly, s: number): Poly {
  return { coeffs: p.coeffs.map((c) => modQ(c * s)), ntt: p.ntt };
}

function polyBitUnpackT1(bytes: Uint8Array): Poly {
  return poly(bitUnpack(bytes, 10));
}

function polyCompact256(p: Poly, m: number): bigint[] {
  const a = p.coeffs;
  const bLen = (a.length * m) / 256;
  const b = Array.from({ length: bLen }, () => 0n);
  for (let i = 0; i < a.length; i++) {
    const idx = Math.floor((i * m) / 256);
    const shift = (i % (256 / m)) * m;
    b[idx] = b[idx]! | (BigInt(a[i]!) << BigInt(shift));
  }
  return b;
}

function mat(rows: number, cols: number): Mat {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => poly([0])));
}

function matScale(m: Mat, s: number): Mat {
  return m.map((row) => row.map((p) => polyScale(p, s)));
}

function matToNtt(m: Mat): Mat {
  return m.map((row) => row.map((p) => polyToNtt(p)));
}

function matBitUnpackT1(bytes: Uint8Array, rows: number, cols: number): Mat {
  const packedLen = 320;
  const m = mat(rows, cols);
  let idx = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      m[i]![j] = polyBitUnpackT1(bytes.subarray(idx, idx + packedLen));
      idx += packedLen;
    }
  }
  return m;
}

function matCompact256(m: Mat, bits: number): bigint[][][] {
  return m.map((row) => row.map((p) => polyCompact256(p, bits)));
}

function rejectionSampleNttPoly(rho: Uint8Array, i: number, j: number): Poly {
  const xof = XOF128(rho);
  const read = xof.get(j, i);
  const coeffs: number[] = [];
  while (coeffs.length < N) {
    const jb = read();
    for (let off = 0; coeffs.length < N && off <= jb.length - 3; off += 3) {
      const v = (jb[off]! | (jb[off + 1]! << 8) | (jb[off + 2]! << 16)) & 0x7fffff;
      if (v < Q) coeffs.push(v);
    }
  }
  xof.clean();
  return poly(coeffs, true);
}

function expandMatrixFromSeed(rho: Uint8Array): Mat {
  const A = mat(K, L);
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < L; j++) A[i]![j] = rejectionSampleNttPoly(rho, i, j);
  }
  return A;
}

function unpackPk(pk: Uint8Array): [Uint8Array, Mat] {
  const rho = pk.subarray(0, 32);
  const t1 = matBitUnpackT1(pk.subarray(32), K, 1);
  return [rho, t1];
}

export function preparePublicKeyForDeployment(
  AhatCompact: bigint[][][],
  tr: Uint8Array,
  t1Compact: bigint[][],
): Hex {
  if (tr.length !== 64) throw new Error(`tr must be exactly 64 bytes, got ${tr.length} bytes`);
  const aHatStringified = AhatCompact.map((row) => row.map((col) => col.map((v) => v)));
  const t1Stringified = t1Compact.map((row) => row.map((v) => v));
  const aHatEncoded = encodeAbiParameters([{ type: "uint256[][][]" }], [aHatStringified]);
  const t1Encoded = encodeAbiParameters([{ type: "uint256[][]" }], [t1Stringified]);
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }],
    [aHatEncoded, `0x${bytesToHex(tr).slice(2)}` as Hex, t1Encoded],
  );
}

/** Expand FIPS-204 ML-DSA-44 public key bytes for `ZKNOX_dilithium.setKey`. */
export function preparePublicKeyFromPublicKey(publicKey: Uint8Array): Hex {
  const [rho, t1] = unpackPk(publicKey);
  const aHat = expandMatrixFromSeed(rho);
  const tr = shake256(publicKey, { dkLen: TR_BYTES });
  const t1Ntt = matToNtt(matScale(t1, 1 << D));
  const aHatCompact = matCompact256(aHat, 32);
  const t1CompactRaw = matCompact256(t1Ntt, 32);
  const t1Compact = t1CompactRaw.map((row) => row[0]!);
  return preparePublicKeyForDeployment(aHatCompact, tr, t1Compact);
}

export function preparePublicKeyFromSeed(seed: Uint8Array): Hex {
  const { publicKey } = ml_dsa44.keygen(seed);
  return preparePublicKeyFromPublicKey(publicKey);
}
