import { GroupedList } from "./GroupedList";
import { IOSButton } from "./IOSButton";

type Props = {
  balanceLabel: string;
  recipient: string;
  sendAmount: string;
  busy: boolean;
  canSend: boolean;
  error: string | null;
  onRecipientChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function SendScreen({
  balanceLabel,
  recipient,
  sendAmount,
  busy,
  canSend,
  error,
  onRecipientChange,
  onAmountChange,
  onCancel,
  onSubmit,
}: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center border-b border-(--color-ios-separator)/40 bg-(--color-ios-bg)/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          className="min-w-[72px] text-left text-[17px] text-(--color-ios-tint)"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold">Send</h1>
        <div className="min-w-[72px]" />
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-4">
        <GroupedList
          rows={[
            {
              label: "Balance",
              value: balanceLabel,
            },
            {
              label: "To",
              control: (
                <input
                  className="w-full rounded-lg bg-transparent text-right font-mono text-[15px] outline-none placeholder:text-(--color-ios-secondary)"
                  value={recipient}
                  onChange={(e) => onRecipientChange(e.target.value)}
                  placeholder="0x…"
                  autoFocus
                  disabled={busy}
                />
              ),
            },
            {
              label: "Amount (ETH)",
              control: (
                <input
                  className="w-full rounded-lg bg-transparent text-right text-[17px] outline-none placeholder:text-(--color-ios-secondary)"
                  value={sendAmount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  disabled={busy}
                />
              ),
            },
          ]}
        />

        <IOSButton
          label={busy ? "Sending…" : "Send"}
          onClick={onSubmit}
          disabled={busy || !canSend}
        />

        {error ? (
          <p className="rounded-2xl bg-(--color-ios-red)/10 px-4 py-3 text-[15px] text-(--color-ios-red)">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}
