"use client";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  /** Secondary text, shown only in the stacked layout. */
  detail?: string;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** One option per row, for labels too long to sit side by side. */
  stacked?: boolean;
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  stacked = false,
}: SegmentedProps<T>) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-medium text-muted">{label}</div>
      <div
        role="radiogroup"
        aria-label={label}
        className={[
          "flex gap-1 rounded-control border border-line bg-canvas p-1",
          stacked ? "flex-col" : "",
        ].join(" ")}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={[
                "flex-1 rounded-[6px] px-2 py-1.5 text-[13px] font-medium transition-colors",
                stacked ? "flex items-baseline justify-between gap-3 text-left" : "whitespace-nowrap",
                selected ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              ].join(" ")}
            >
              <span>{option.label}</span>
              {stacked && option.detail && (
                <span className="text-[12px] font-normal text-subtle">{option.detail}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
