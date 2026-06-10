import type { ReactNode } from "react";

type Row = { label: string; value: string } | { label: string; control: ReactNode };

type Props = {
  header?: string;
  footer?: string;
  rows: Row[];
};

export function GroupedList({ header, footer, rows }: Props) {
  return (
    <section>
      {header ? (
        <h3 className="mb-2 px-4 text-[13px] uppercase tracking-wide text-(--color-ios-secondary)">
          {header}
        </h3>
      ) : null}
      <ul className="overflow-hidden rounded-[12px] bg-(--color-ios-card) shadow-sm">
        {rows.map((row, i) => (
          <li
            key={row.label}
            className={`flex min-h-[44px] items-center justify-between gap-3 px-4 py-3 ${
              i < rows.length - 1 ? "border-b border-(--color-ios-separator)/50" : ""
            }`}
          >
            <span className="shrink-0 text-[17px]">{row.label}</span>
            {"value" in row ? (
              <span className="truncate text-right text-[17px] text-(--color-ios-secondary)">
                {row.value}
              </span>
            ) : (
              <div className="min-w-0 flex-1">{row.control}</div>
            )}
          </li>
        ))}
      </ul>
      {footer ? (
        <p className="mt-2 px-4 text-[13px] leading-relaxed text-(--color-ios-secondary)">
          {footer}
        </p>
      ) : null}
    </section>
  );
}
