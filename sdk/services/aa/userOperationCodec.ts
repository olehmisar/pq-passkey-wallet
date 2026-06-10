import type { UserOperation } from "viem/account-abstraction";

const BIGINT_RE = /^\d+$/;

export function serializeUserOperation(userOperation: UserOperation<"0.9">): string {
  return JSON.stringify(userOperation, (_key, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export function deserializeUserOperation(serialized: string): UserOperation<"0.9"> {
  return JSON.parse(serialized, (_key, value: unknown) => {
    if (typeof value === "string" && BIGINT_RE.test(value)) return BigInt(value);
    return value;
  }) as UserOperation<"0.9">;
}
