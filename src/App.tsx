import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { formatEther, isAddress, parseEther } from "viem";
import { LargeBlobNotSupportedError, WalletNotFoundError, sdk } from "#sdk";
import type { WalletRecord } from "#sdk";
import { GroupedList } from "./components/GroupedList";
import { IOSButton } from "./components/IOSButton";
import { LargeTitleNav } from "./components/LargeTitleNav";
import { SendScreen } from "./components/SendScreen";
import { WalletPassCard } from "./components/WalletPassCard";
import { appendTx, formatSentAt, loadTxHistory, type TxRecord } from "./txHistory";

type Session = {
  record: WalletRecord;
  displayName: string;
};

function shortAddress(address: string | undefined): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function App() {
  const [displayName, setDisplayName] = useState("My PQ Wallet");
  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("0.0001");
  const [sendOpen, setSendOpen] = useState(false);
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const refreshBalance = useCallback(async (record: WalletRecord) => {
    try {
      const next = await sdk.wallet.getBalance(record);
      setBalance(next);
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    const restored = sdk.wallet.restoreSession();
    if (restored) setSession(restored);
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshBalance(session.record);
    const address = session.record.blob.accountAddress;
    if (address) setTxHistory(loadTxHistory(address));
  }, [session, refreshBalance]);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const name = displayName.trim() || "My PQ Wallet";
      const record = await sdk.wallet.createWallet(name);
      setSession({ record, displayName: name });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSignIn() {
    setBusy(true);
    setError(null);
    setSession(null);
    setBalance(null);
    setTxHistory([]);
    setSendOpen(false);
    try {
      const name = displayName.trim() || "My PQ Wallet";
      const record = await sdk.wallet.signIn(name);
      setSession({ record, displayName: name });
    } catch (e) {
      if (e instanceof WalletNotFoundError) {
        setError("No wallet on this passkey — create one first.");
      } else {
        setError(formatError(e));
      }
    } finally {
      setBusy(false);
    }
  }

  function onSignOut() {
    sdk.wallet.clearSession();
    setSession(null);
    setBalance(null);
    setTxHistory([]);
    setSendOpen(false);
    setError(null);
  }

  function returnToWallet() {
    setSendOpen(false);
    setError(null);
  }

  function openSend() {
    setError(null);
    setSendNotice(null);
    setSendOpen(true);
    if (session) void refreshBalance(session.record);
  }

  function closeSend() {
    if (busy) return;
    returnToWallet();
  }

  async function onFund() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await sdk.wallet.fundRecommendedTestEth(session.record);
      await refreshBalance(session.record);
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!session) return;
    const to = recipient.trim();
    if (!isAddress(to)) {
      setError("Enter a valid recipient address.");
      return;
    }
    let value: bigint;
    try {
      value = parseEther(sendAmount.trim() || "0");
    } catch {
      setError("Enter a valid amount.");
      return;
    }
    if (value <= 0n) {
      setError("Enter an amount greater than 0.");
      return;
    }

    const fromAddress = session.record.blob.accountAddress;
    if (!fromAddress) {
      setError("Wallet missing smart-account address.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const hash = await sdk.wallet.sendEth(session.record, { to: to as Address, value });
      await sdk.publicClient.waitForTransactionReceipt({ hash });
      setTxHistory(
        appendTx(fromAddress, { hash: hash as Hex, to: to as Address, valueWei: value.toString() }),
      );
      await refreshBalance(session.record);
      setRecipient("");
      setSendAmount("0.0001");
      setSendNotice(`Sent ${formatEther(value)} ETH`);
      returnToWallet();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const accountAddress = session?.record.blob.accountAddress;

  if (session && sendOpen) {
    return (
      <div className="mx-auto max-w-md">
        <SendScreen
          balanceLabel={balance !== null ? `${formatEther(balance)} ETH` : "…"}
          recipient={recipient}
          sendAmount={sendAmount}
          busy={busy}
          canSend={Boolean(accountAddress)}
          error={error}
          onRecipientChange={setRecipient}
          onAmountChange={setSendAmount}
          onCancel={closeSend}
          onSubmit={onSend}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <LargeTitleNav title="Wallet" subtitle="Post-quantum · Passkey" />

        <main className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-2">
          <GroupedList
            header="Create"
            rows={[
              {
                label: "Display name",
                control: (
                  <input
                    className="w-full rounded-lg bg-transparent text-right text-[17px] outline-none placeholder:text-(--color-ios-secondary)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Wallet name"
                  />
                ),
              },
            ]}
            footer="Passkey must support WebAuthn largeBlob (Safari or Chrome with macOS Passwords)."
          />
          <div className="flex flex-col gap-3">
            <IOSButton
              label={busy ? "Creating…" : "Create Wallet"}
              onClick={onCreate}
              disabled={busy}
            />
            <div
              className="h-px bg-(--color-ios-separator)/60"
              role="separator"
              aria-hidden="true"
            />
            <IOSButton
              label={busy ? "Signing in…" : "Sign In"}
              onClick={onSignIn}
              disabled={busy}
              variant="secondary"
            />
          </div>

          {error ? (
            <p className="rounded-2xl bg-(--color-ios-red)/10 px-4 py-3 text-[15px] text-(--color-ios-red)">
              {error}
            </p>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <LargeTitleNav title="Wallet" subtitle="Signed in" />

      <main className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-2">
        <WalletPassCard
          title={session.displayName}
          subtitle={shortAddress(accountAddress)}
          accent="emerald"
          primaryValue={balance !== null ? `${formatEther(balance)} ETH` : "…"}
          primaryLabel="BALANCE"
        />

        {sendNotice ? (
          <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-[15px] text-emerald-700 dark:text-emerald-300">
            {sendNotice}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <IOSButton label="Send" onClick={openSend} disabled={busy || !accountAddress} />
          <IOSButton
            label={busy ? "Funding…" : "Add test ETH"}
            onClick={onFund}
            disabled={busy}
            variant="secondary"
          />
          <IOSButton label="Sign Out" onClick={onSignOut} disabled={busy} variant="secondary" />
        </div>

        {txHistory.length > 0 ? (
          <GroupedList
            header="Activity"
            rows={txHistory.map((tx) => ({
              label: `−${formatEther(BigInt(tx.valueWei))} ETH`,
              value: `${shortAddress(tx.to)} · ${formatSentAt(tx.sentAt)}`,
            }))}
          />
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-(--color-ios-red)/10 px-4 py-3 text-[15px] text-(--color-ios-red)">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}

function formatError(error: unknown): string {
  if (error instanceof LargeBlobNotSupportedError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
