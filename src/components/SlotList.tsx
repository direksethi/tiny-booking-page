"use client";

import { formatTime } from "@/lib/format";

interface SlotListProps {
  slots: number[];
  timeZone: string;
  selected: number | null;
  onSelect: (startsAt: number) => void;
  loading: boolean;
  day: string | null;
}

export function SlotList({
  slots,
  timeZone,
  selected,
  onSelect,
  loading,
  day,
}: SlotListProps) {
  if (!day) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-subtle">
        Select a date
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-9 animate-pulse rounded-control bg-canvas"
          />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-subtle">
        No times available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
      {slots.map((startsAt) => {
        const isSelected = startsAt === selected;
        return (
          <button
            key={startsAt}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(startsAt)}
            className={[
              "rounded-control border py-2 text-[13px] font-medium tabular-nums transition-colors",
              isSelected
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-surface text-ink hover:border-subtle",
            ].join(" ")}
          >
            {formatTime(startsAt, timeZone)}
          </button>
        );
      })}
    </div>
  );
}
