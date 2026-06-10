import { describe, expect, it } from "vite-plus/test";
import { createPublicClient, http } from "viem";
import { ViemAccountAbstractionService } from "./services/aa/AccountAbstractionService";

describe("account abstraction helpers", () => {
  it("registerPublicKey fails closed without mlDsaVerifierAddress", async () => {
    const publicClient = createPublicClient({
      chain: {
        id: 31337,
        name: "dev",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
      },
      transport: http("http://127.0.0.1:8545"),
    });
    const aaSvc = new ViemAccountAbstractionService({
      publicClient,
      deployment: {
        chainId: 31337,
        rpcUrl: "http://127.0.0.1:8545",
        entryPointAddress: "0x0000000000000000000000000000000000000001",
        entryPointVersion: "0.9",
      },
    });

    await expect(aaSvc.registerPublicKey(`0x${"ab".repeat(64)}` as const)).rejects.toThrow(
      /mlDsaVerifierAddress is required/,
    );
  });
});
