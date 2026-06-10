type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function IOSButton({ label, onClick, disabled, variant = "primary" }: Props) {
  const base =
    "flex h-[50px] w-full items-center justify-center rounded-[14px] text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-40";
  const styles =
    variant === "primary"
      ? `${base} bg-(--color-ios-tint) text-white`
      : `${base} bg-(--color-ios-card) text-(--color-ios-tint)`;

  return (
    <button type="button" className={styles} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
