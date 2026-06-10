export class SdkError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SdkError";
    this.code = code;
  }
}

export class LargeBlobNotSupportedError extends SdkError {
  constructor() {
    super(
      "This authenticator does not support the WebAuthn largeBlob extension. " +
        "Use Safari or Chrome with macOS Passwords / iCloud Keychain.",
      "LARGE_BLOB_NOT_SUPPORTED",
    );
    this.name = "LargeBlobNotSupportedError";
  }
}

export class WalletNotFoundError extends SdkError {
  constructor() {
    super("No wallet found for this passkey.", "WALLET_NOT_FOUND");
    this.name = "WalletNotFoundError";
  }
}
