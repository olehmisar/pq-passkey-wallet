type Props = {
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function IOSButton({ label, detail, onClick, disabled, variant = "primary" }: Props) {
  const base =
    "flex w-full items-center justify-center rounded-[14px] text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-40";
  const size = detail ? "min-h-[50px] flex-col gap-0.5 px-4 py-3" : "h-[50px]";
  const styles =
    variant === "primary"
      ? `${base} ${size} bg-(--color-ios-tint) text-white`
      : `${base} ${size} bg-(--color-ios-card) text-(--color-ios-tint)`;

  return (
    <button type="button" className={styles} onClick={onClick} disabled={disabled}>
      <span>{label}</span>
      {detail ? (
        <span
          className="text-center text-[13px] font-normal leading-snug opacity-90"
          aria-live="polite"
        >
          {detail}
        </span>
      ) : null}
    </button>
  );
}
