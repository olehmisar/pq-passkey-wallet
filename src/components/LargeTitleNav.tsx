type Props = {
  title: string;
  subtitle?: string;
};

export function LargeTitleNav({ title, subtitle }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-(--color-ios-separator)/40 bg-(--color-ios-bg)/80 px-4 pb-3 pt-4 backdrop-blur-xl">
      {subtitle ? (
        <p className="text-[13px] font-medium uppercase tracking-wide text-(--color-ios-secondary)">
          {subtitle}
        </p>
      ) : null}
      <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
    </header>
  );
}
