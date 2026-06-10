export type CreateWalletStage = "passkey" | "pq-keys" | "register-key" | "save-blob" | "fund";

const STAGE_LABELS: Record<CreateWalletStage, string> = {
  passkey: "Confirm with Touch ID or your passkey prompt",
  "pq-keys": "Generating ML-DSA-44 key pair",
  "register-key": "Registering public key on Sepolia",
  "save-blob": "Saving encrypted wallet to passkey",
  fund: "Sending test ETH to your smart account",
};

export function createWalletStageLabel(stage: CreateWalletStage): string {
  return STAGE_LABELS[stage];
}

export type CreateWalletOptions = {
  onProgress?: (stage: CreateWalletStage) => void;
};
