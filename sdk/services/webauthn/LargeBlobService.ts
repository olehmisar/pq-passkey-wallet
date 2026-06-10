import { Authentication } from "ox/webauthn";
import {
  blobToArrayBuffer,
  randomWebAuthnChallenge,
  rpIdOrDefault,
  type LargeBlobAssertionExtension,
  type LargeBlobClientExtensionResults,
} from "./helpers";

export type LargeBlobReadResult = {
  blob: Uint8Array | null;
};

export class LargeBlobService {
  async write(params: { credentialId: string; blob: Uint8Array; rpId?: string }): Promise<void> {
    const extensions: { largeBlob: LargeBlobAssertionExtension } = {
      largeBlob: { write: blobToArrayBuffer(params.blob) },
    };

    const request = Authentication.getOptions({
      credentialId: params.credentialId,
      challenge: randomWebAuthnChallenge(),
      rpId: rpIdOrDefault(params.rpId),
      userVerification: "required",
      extensions: extensions as never,
    });

    const credential = (await navigator.credentials.get(
      request as CredentialRequestOptions,
    )) as PublicKeyCredential | null;

    if (!credential) throw new Error("largeBlob write: no credential returned");

    const results = credential.getClientExtensionResults() as LargeBlobClientExtensionResults;
    if (!results.largeBlob?.written) {
      throw new Error("largeBlob write failed — authenticator did not confirm write");
    }
  }

  async readDiscoverable(params?: { rpId?: string }) {
    const extensions: { largeBlob: LargeBlobAssertionExtension } = {
      largeBlob: { read: true },
    };

    const request = Authentication.getOptions({
      challenge: randomWebAuthnChallenge(),
      rpId: rpIdOrDefault(params?.rpId),
      userVerification: "required",
      extensions: extensions as never,
    });

    const credential = (await navigator.credentials.get(
      request as CredentialRequestOptions,
    )) as PublicKeyCredential | null;

    if (!credential) throw new Error("largeBlob read: no credential returned");

    const results = credential.getClientExtensionResults() as LargeBlobClientExtensionResults;
    const buf = results.largeBlob?.blob;
    return {
      credentialId: credential.id,
      blob: buf ? new Uint8Array(buf) : null,
    };
  }

  async read(params: { credentialId: string; rpId?: string }) {
    const extensions: { largeBlob: LargeBlobAssertionExtension } = {
      largeBlob: { read: true },
    };

    const request = Authentication.getOptions({
      credentialId: params.credentialId,
      challenge: randomWebAuthnChallenge(),
      rpId: rpIdOrDefault(params.rpId),
      userVerification: "required",
      extensions: extensions as never,
    });

    const credential = (await navigator.credentials.get(
      request as CredentialRequestOptions,
    )) as PublicKeyCredential | null;

    if (!credential) throw new Error("largeBlob read: no credential returned");

    const results = credential.getClientExtensionResults() as LargeBlobClientExtensionResults;
    const buf = results.largeBlob?.blob;
    return {
      blob: buf ? new Uint8Array(buf) : null,
    };
  }
}
