import { defineHandler } from "nitro";
import type { Address } from "viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { DirectUserOperationService } from "../../../../sdk/services/aa/DirectUserOperationService";
import { deserializeUserOperation } from "../../../../sdk/services/aa/userOperationCodec";
import { fundDevBundler, getDevBundlerKey } from "../../../lib/devBundler";
import { DEV_CHAIN_ID, DEV_RPC_URL } from "../../../lib/devConstants";

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

/** Dev-only bundler relay — PQ signing stays in the browser. */
export default defineHandler(async (event) => {
  try {
    const { entryPoint, userOperation: serialized } = (await event.req.json()) as HandleOpsBody;
    if (!entryPoint || !serialized) {
      return jsonError("entryPoint and userOperation are required", 400);
    }

    const beneficiary = await fundDevBundler();
    const bundlerAccount = privateKeyToAccount(getDevBundlerKey());
    const publicClient = createPublicClient({
      chain: {
        id: DEV_CHAIN_ID,
        name: "dev",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [DEV_RPC_URL] } },
      },
      transport: http(DEV_RPC_URL),
    });
    const walletClient = createWalletClient({
      account: bundlerAccount,
      chain: publicClient.chain,
      transport: http(DEV_RPC_URL),
    });

    const hash = await new DirectUserOperationService(publicClient).submitHandleOps({
      entryPoint,
      walletClient,
      userOperation: deserializeUserOperation(serialized),
      beneficiary,
    });

    return { hash };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error));
  }
});
