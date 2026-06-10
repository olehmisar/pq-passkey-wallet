import type { Address, Hex } from "viem";

const STORAGE_PREFIX = "pq-passkey-wallet/tx-history/v1/";
const MAX_ENTRIES = 50;

export type TxRecord = {
  hash: Hex;
  to: Address;
  valueWei: string;
  sentAt: string;
};

function storageKey(accountAddress: Address): string {
  return `${STORAGE_PREFIX}${accountAddress.toLowerCase()}`;
}

export function loadTxHistory(accountAddress: Address): TxRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(accountAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TxRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendTx(
  accountAddress: Address,
  tx: { hash: Hex; to: Address; valueWei: string },
): TxRecord[] {
  const entry: TxRecord = { ...tx, sentAt: new Date().toISOString() };
  const next = [entry, ...loadTxHistory(accountAddress)].slice(0, MAX_ENTRIES);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(accountAddress), JSON.stringify(next));
  }
  return next;
}

export function formatSentAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
