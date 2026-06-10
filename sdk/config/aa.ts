import { entryPoint09Address } from "viem/account-abstraction";
import { sepolia } from "viem/chains";

/** FIPS-204 ML-DSA-44 signature byte length (cTilde + z + h). */
export const ML_DSA_SIGNATURE_BYTES = 2420;

/**
 * Chain + ERC-4337 deployment config.
 * Override via `createSdk({ aa: { ... } })` or Vite env vars.
 */
export type AaDeploymentConfig = {
  chainId: number;
  rpcUrl: string;
  bundlerUrl?: string;
  entryPointAddress: `0x${string}`;
  entryPointVersion: "0.9";
  /** `ZKNOX_dilithium` verifier — stores PK via SSTORE2 (`setKey`). */
  mlDsaVerifierAddress?: `0x${string}`;
  /** Locally deployed `PqSimpleAccountFactory`. */
  pqAccountFactoryAddress?: `0x${string}`;
  /** CREATE2 salt for counterfactual account address. */
  accountSalt?: bigint;
};

export function resolveAaConfig(overrides?: Partial<AaDeploymentConfig>): AaDeploymentConfig {
  const chainId = overrides?.chainId ?? Number(import.meta.env.VITE_CHAIN_ID ?? sepolia.id);
  const rpcUrl =
    overrides?.rpcUrl ??
    (import.meta.env.VITE_RPC_URL as string | undefined) ??
    sepolia.rpcUrls.default.http[0];

  return {
    chainId,
    rpcUrl,
    bundlerUrl: overrides?.bundlerUrl ?? (import.meta.env.VITE_BUNDLER_URL as string | undefined),
    entryPointAddress:
      overrides?.entryPointAddress ??
      (import.meta.env.VITE_ENTRY_POINT_ADDRESS as `0x${string}` | undefined) ??
      entryPoint09Address,
    entryPointVersion: "0.9",
    mlDsaVerifierAddress:
      overrides?.mlDsaVerifierAddress ??
      (import.meta.env.VITE_ML_DSA_VERIFIER as `0x${string}` | undefined),
    pqAccountFactoryAddress:
      overrides?.pqAccountFactoryAddress ??
      (import.meta.env.VITE_PQ_ACCOUNT_FACTORY as `0x${string}` | undefined),
    accountSalt: overrides?.accountSalt ?? 0n,
  };
}
