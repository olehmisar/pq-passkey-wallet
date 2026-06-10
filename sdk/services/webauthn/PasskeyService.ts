import type { PublicKey } from "ox";
import { Registration } from "ox/webauthn";
import { LargeBlobNotSupportedError } from "../../errors";
import { rpIdOrDefault, type LargeBlobClientExtensionResults } from "./helpers";

export type CreatePasskeyParams = {
  displayName: string;
  userId?: Uint8Array;
  rpId?: string;
};

export type LargeBlobRegistrationResult = {
  supported: boolean;
  maxSize?: number;
};

export type PasskeyCredential = {
  id: string;
  publicKey: PublicKey.PublicKey;
  largeBlob: LargeBlobRegistrationResult;
};

function parseLargeBlobRegistrationResults(
  credential: PublicKeyCredential,
): LargeBlobRegistrationResult {
  const ext = credential.getClientExtensionResults() as LargeBlobClientExtensionResults;
  const supported = ext.largeBlob?.supported === true;
  return { supported };
}

export class PasskeyService {
  async create(params: CreatePasskeyParams): Promise<PasskeyCredential> {
    const rpId = rpIdOrDefault(params.rpId);

    const credential = await Registration.create({
      name: params.displayName,
      rp: { id: rpId, name: document.title || "PQ Passkey Wallet" },
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      extensions: {
        largeBlob: { support: "required" },
      },
      ...(params.userId ? { user: { id: params.userId, name: params.displayName } } : {}),
    });

    const largeBlob = parseLargeBlobRegistrationResults(
      credential.raw as unknown as PublicKeyCredential,
    );
    if (!largeBlob.supported) {
      throw new LargeBlobNotSupportedError();
    }

    return {
      id: credential.id,
      publicKey: credential.publicKey,
      largeBlob,
    };
  }
}
