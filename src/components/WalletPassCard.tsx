type Accent = "emerald" | "slate" | "blue";

const accentMap: Record<Accent, string> = {
  emerald: "from-emerald-600 to-teal-800",
  slate: "from-zinc-700 to-zinc-900",
  blue: "from-blue-600 to-indigo-900",
};

type Props = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: string;
  accent?: Accent;
  /** When set, subtitle is tappable and copies this value (e.g. full address). */
  copyValue?: string;
  copied?: boolean;
  onCopy?: () => void;
};

export function WalletPassCard({
  title,
  subtitle,
  primaryLabel,
  primaryValue,
  accent = "blue",
  copyValue,
  copied = false,
  onCopy,
}: Props) {
  const canCopy = Boolean(copyValue && onCopy);

  return (
    <article className="overflow-hidden rounded-[20px] shadow-lg shadow-black/10">
      <div className={`bg-linear-to-br ${accentMap[accent]} px-5 pb-8 pt-5 text-white`}>
        <p className="text-[13px] font-medium uppercase tracking-wider text-white/70">PQ Passkey</p>
        <h2 className="mt-1 text-[22px] font-semibold leading-snug">{title}</h2>
        {canCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="mt-1 flex items-center gap-2 text-[15px] text-white/80 transition-colors active:text-white"
            aria-label="Copy wallet address"
          >
            <span className="font-mono">{subtitle}</span>
            <span className="text-[13px] font-medium text-white/90">
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
        ) : (
          <p className="mt-1 font-mono text-[15px] text-white/80">{subtitle}</p>
        )}
      </div>
      <div className="bg-(--color-ios-card) px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-ios-secondary)">
          {primaryLabel}
        </p>
        <p className="mt-1 font-mono text-[15px] font-medium">{primaryValue}</p>
      </div>
    </article>
  );
}
