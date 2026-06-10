import { defineHandler } from "nitro";
import type { Address } from "viem";

import { DirectUserOperationService } from "../../../sdk/services/aa/DirectUserOperationService";
import { deserializeUserOperation } from "../../../sdk/services/aa/userOperationCodec";
import { createTestnetClients } from "../../lib/testnetClients";
import { testnetEntryPointAddress } from "../../lib/testnetEnv";

type HandleOpsBody = {
  entryPoint?: Address;
  userOperation?: string;
};

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Testnet bundler relay — PQ signing stays in the browser. */
export default defineHandler(async (event) => {
  try {
    const { entryPoint, userOperation: serialized } = (await event.req.json()) as HandleOpsBody;
    if (!serialized) {
      return jsonError("userOperation is required", 400);
    }

    const { account, publicClient, walletClient } = createTestnetClients();
    const hash = await new DirectUserOperationService(publicClient).submitHandleOps({
      entryPoint: entryPoint ?? testnetEntryPointAddress(),
      walletClient,
      userOperation: deserializeUserOperation(serialized),
      beneficiary: account.address,
    });

    return { hash };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error));
  }
});
