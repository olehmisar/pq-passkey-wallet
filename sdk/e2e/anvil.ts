import { Instance } from "prool";
import { createPublicClient, createTestClient, createWalletClient, http, type Chain } from "viem";
import { mainnet } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ANVIL_BINARY, ANVIL_PRIVATE_KEY, MAINNET_FORK_URL } from "./constants";

export type AnvilHarness = {
  anvil: ReturnType<typeof Instance.anvil>;
  rpcUrl: string;
  chain: Chain;
  publicClient: ReturnType<typeof createPublicClient>;
  testClient: ReturnType<typeof createTestClient>;
  /** Deploys contracts / funds accounts (Anvil dev key #0). */
  deployerWalletClient: ReturnType<typeof createWalletClient>;
  /** Submits `handleOps` — must be a codeless EOA (dev key #0 has code on mainnet fork). */
  bundlerWalletClient: ReturnType<typeof createWalletClient>;
  bundlerAccount: ReturnType<typeof privateKeyToAccount>;
};

/** Plain local Anvil (no fork) — faster for contract-heavy unit fuzz. */
export async function startLocalAnvil(port = 18_546): Promise<AnvilHarness> {
  const anvil = Instance.anvil(
    {
      chainId: 31_337,
      binary: ANVIL_BINARY,
      port,
    },
    { timeout: 120_000 },
  );
  await anvil.start();

  const rpcUrl = `http://${anvil.host}:${anvil.port}`;
  const chain: Chain = {
    id: 31_337,
    name: "dev",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };

  const deployerAccount = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const bundlerAccount = privateKeyToAccount(generatePrivateKey());
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({ chain, transport });
  const testClient = createTestClient({ chain, mode: "anvil", transport });
  const deployerWalletClient = createWalletClient({
    account: deployerAccount,
    chain,
    transport,
  });
  const bundlerWalletClient = createWalletClient({
    account: bundlerAccount,
    chain,
    transport,
  });

  await testClient.setBalance({
    address: bundlerAccount.address,
    value: 10n ** 19n,
  });

  return {
    anvil,
    rpcUrl,
    chain,
    publicClient,
    testClient,
    deployerWalletClient,
    bundlerWalletClient,
    bundlerAccount,
  };
}

export async function startMainnetForkAnvil(): Promise<AnvilHarness> {
  const anvil = Instance.anvil(
    {
      forkUrl: MAINNET_FORK_URL,
      chainId: mainnet.id,
      binary: ANVIL_BINARY,
      // Avoid clashing with dev-stack Anvil on 8545.
      port: 18_545,
    },
    { timeout: 120_000 },
  );
  await anvil.start();

  const rpcUrl = `http://${anvil.host}:${anvil.port}`;
  const chain: Chain = {
    ...mainnet,
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  };

  const deployerAccount = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const bundlerAccount = privateKeyToAccount(generatePrivateKey());
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({ chain, transport });
  const testClient = createTestClient({ chain, mode: "anvil", transport });
  const deployerWalletClient = createWalletClient({
    account: deployerAccount,
    chain,
    transport,
  });
  const bundlerWalletClient = createWalletClient({
    account: bundlerAccount,
    chain,
    transport,
  });

  await testClient.setBalance({
    address: bundlerAccount.address,
    value: 10n ** 19n,
  });

  return {
    anvil,
    rpcUrl,
    chain,
    publicClient,
    testClient,
    deployerWalletClient,
    bundlerWalletClient,
    bundlerAccount,
  };
}

export async function stopAnvilHarness(harness: AnvilHarness): Promise<void> {
  await harness.anvil.stop();
}
