import type { Client } from "viem";
import { estimateFeesPerGas, getBlock } from "viem/actions";

/** Matches `PqUserOpBuilder` in contract tests — ML-DSA validation is ~8.3M gas. */
export const PQ_USER_OP_GAS = {
  callGasLimit: 500_000n,
  preVerificationGas: 150_000n,
  verificationGasLimit: 10_000_000n,
} as const;

/** Counterfactual first UserOp — same validation budget; extra headroom on call + preVerification. */
export const PQ_DEPLOY_USER_OP_GAS = {
  callGasLimit: 500_000n,
  preVerificationGas: 250_000n,
  verificationGasLimit: 10_000_000n,
} as const;

/** Testnet prefund ceiling — viem's prepareUserOperation defaults to ~2× this otherwise. */
export const TESTNET_MAX_FEE_CEILING = 6_000_000_000n; // 6 gwei

/** Headroom for send value + base-fee drift between fund and submit. */
const TEST_FUNDING_BUFFER = 5_000_000_000_000_000n; // 0.005 ETH

export type UserOpGasLimits = {
  callGasLimit: bigint;
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
};

/**
 * Fee caps for PQ UserOps on testnet.
 * Must be >= block base fee (EIP-1559) but below viem's 2× estimate to keep prefund affordable.
 */
export async function cappedUserOpFees(client: Client) {
  const [fees, block] = await Promise.all([estimateFeesPerGas(client), getBlock(client)]);
  const baseFee = block.baseFeePerGas ?? 0n;

  let maxFeePerGas = fees.maxFeePerGas;
  let maxPriorityFeePerGas = fees.maxPriorityFeePerGas;

  if (maxFeePerGas > TESTNET_MAX_FEE_CEILING) maxFeePerGas = TESTNET_MAX_FEE_CEILING;
  // EIP-1559 validity — if base fee exceeds the ceiling, prefund must reflect reality.
  if (baseFee > maxFeePerGas) maxFeePerGas = baseFee;
  if (maxPriorityFeePerGas > maxFeePerGas) maxPriorityFeePerGas = maxFeePerGas;

  return { maxFeePerGas, maxPriorityFeePerGas };
}

/** EntryPoint prefund reserved from the smart-account ETH balance. */
export function estimateUserOpPrefund(gas: UserOpGasLimits, maxFeePerGas: bigint): bigint {
  return (gas.verificationGasLimit + gas.callGasLimit + gas.preVerificationGas) * maxFeePerGas;
}

/** Conservative prefund estimate for balance checks and faucet amounts. */
export function conservativeUserOpPrefund(gas: UserOpGasLimits, maxFeePerGas: bigint): bigint {
  return estimateUserOpPrefund(gas, maxFeePerGas);
}

/** Recommended testnet funding — live prefund + 10% headroom + buffer for one send. */
export function recommendedTestFundingWei(gas: UserOpGasLimits, maxFeePerGas: bigint): bigint {
  const prefund = conservativeUserOpPrefund(gas, maxFeePerGas);
  return prefund + prefund / 10n + TEST_FUNDING_BUFFER;
}
