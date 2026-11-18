"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarProps {
  month: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  available: Record<string, number>;
  selected: string | null;
  onSelect: (day: string) => void;
  minMonth: string;
  maxMonth: string;
  loading: boolean;
}

function shiftMonth(month: string, amount: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, index - 1, 1)));
}

/** Day cells for the month, padded so the grid starts on Monday. */
function buildGrid(month: string): (string | null)[] {
  const [year, index] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, index, 0)).getUTCDate();

  // getUTCDay: 0 = Sunday. Shift so Monday is column 0.
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

export function Calendar({
  month,
  onMonthChange,
  available,
  selected,
  onSelect,
  minMonth,
  maxMonth,
  loading,
}: CalendarProps) {
  const cells = useMemo(() => buildGrid(month), [month]);
  const canGoBack = month > minMonth;
  const canGoForward = month < maxMonth;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{monthLabel(month)}</div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={!canGoBack}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="rounded-[6px] p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={!canGoForward}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="rounded-[6px] p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-medium text-subtle"
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className={[
          "grid grid-cols-7 gap-1 transition-opacity",
          loading ? "opacity-40" : "opacity-100",
        ].join(" ")}
      >
        {cells.map((day, index) => {
          if (!day) return <div key={`pad-${index}`} />;

          const open = (available[day] ?? 0) > 0;
          const isSelected = day === selected;
          const dayNumber = Number(day.slice(-2));

          return (
            <button
              key={day}
              type="button"
              disabled={!open}
              aria-pressed={isSelected}
              onClick={() => onSelect(day)}
              className={[
                "aspect-square rounded-[6px] text-[13px] font-medium transition-colors",
                isSelected
                  ? "bg-accent text-accent-ink"
                  : open
                    ? "bg-canvas text-ink hover:bg-[#e9ebed]"
                    : "text-subtle",
              ].join(" ")}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
