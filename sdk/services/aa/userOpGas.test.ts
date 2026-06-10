import { describe, expect, it } from "vite-plus/test";
import { estimateUserOpPrefund, PQ_DEPLOY_USER_OP_GAS } from "./userOpGas";

describe("userOpGas", () => {
  it("prefund at 1 gwei fits in 0.015 ETH test funding", () => {
    const prefund = estimateUserOpPrefund(PQ_DEPLOY_USER_OP_GAS, 1_000_000_000n);
    expect(prefund).toBeLessThanOrEqual(15_000_000_000_000_000n);
  });
});
