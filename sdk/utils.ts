import { createPublicClient, http, type Chain } from "viem";
import { mainnet, sepolia } from "viem/chains";

const anvil: Chain = {
  id: 31_337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
};

const CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [anvil.id]: anvil,
};

export function createAppPublicClient(config: { rpcUrl: string; chainId?: number }) {
  const chainId = config.chainId ?? mainnet.id;
  const chain =
    CHAINS[chainId] ??
    ({
      ...mainnet,
      id: chainId,
      name: `Chain ${chainId}`,
      rpcUrls: { default: { http: [config.rpcUrl] } },
    } satisfies Chain);

  return createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });
}

/** Shared viem public client type — inferred once from {@link createAppPublicClient}. */
export type AppPublicClient = ReturnType<typeof createAppPublicClient>;
