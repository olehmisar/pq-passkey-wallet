import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { requireFunderPrivateKey, testnetChainId, testnetRpcUrl } from "./testnetEnv";

export function testnetChain(): Chain {
  const chainId = testnetChainId();
  if (chainId === sepolia.id) return sepolia;
  return {
    id: chainId,
    name: "testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [testnetRpcUrl()] } },
  };
}

export function createTestnetClients() {
  const chain = testnetChain();
  const rpcUrl = testnetRpcUrl();
  const account = privateKeyToAccount(requireFunderPrivateKey());
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  return { account, publicClient, walletClient };
}
