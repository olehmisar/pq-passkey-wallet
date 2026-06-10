import type { AaDeploymentConfig } from "./config/aa";
import { resolveAaConfig } from "./config/aa";
import { createAppPublicClient } from "./utils";
import { LargeBlobNotSupportedError, WalletNotFoundError } from "./errors";
import { ViemAccountAbstractionService } from "./services/aa/AccountAbstractionService";
import { MlDsaPqKeyService, type PqKeyServiceLike } from "./services/crypto/MlDsaPqKeyService";
import { LargeBlobService } from "./services/webauthn/LargeBlobService";
import { PasskeyService } from "./services/webauthn/PasskeyService";
import { PasskeyPqWalletService } from "./services/wallet/PasskeyPqWalletService";

export { LargeBlobNotSupportedError, WalletNotFoundError };
export type { WalletRecord } from "./services/wallet/PasskeyPqWalletService";
export type { PqKeyServiceLike };

export type SdkConfig = {
  rpcUrl?: string;
  chainId?: number;
  aa?: Partial<AaDeploymentConfig>;
  deployerPrivateKey?: `0x${string}`;
  bundlerPrivateKey?: `0x${string}`;
  pqKey?: PqKeyServiceLike;
};

export function createSdk(config: SdkConfig = {}) {
  const aaConfig = resolveAaConfig({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    ...config.aa,
  });

  const publicClient = createAppPublicClient({
    rpcUrl: aaConfig.rpcUrl,
    chainId: aaConfig.chainId,
  });

  const passkey = new PasskeyService();
  const largeBlob = new LargeBlobService();
  const pqKey = config.pqKey ?? new MlDsaPqKeyService();
  const aa = new ViemAccountAbstractionService({
    publicClient,
    deployment: aaConfig,
    deployerPrivateKey: config.deployerPrivateKey,
  });

  const wallet = new PasskeyPqWalletService({
    passkey,
    largeBlob,
    pqKey,
    publicClient,
    aa,
    aaConfig,
    bundlerPrivateKey: config.bundlerPrivateKey,
  });

  return {
    aa,
    aaConfig,
    largeBlob,
    passkey,
    pqKey,
    publicClient,
    wallet,
  };
}

export type Sdk = ReturnType<typeof createSdk>;

/** Default app SDK — ML-DSA-44 PQ signing runs in-browser via `@noble/post-quantum`. */
export const sdk = createSdk();
