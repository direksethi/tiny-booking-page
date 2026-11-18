import { TZDate } from "@date-fns/tz";

import { type BookingConfig, isCalendarDate, windowsForWeekday } from "./config";

/**
 * Slot generation. Every calculation names the host time zone explicitly, so
 * the result does not depend on the time zone of the machine running the app.
 */

/** The part of the configuration that decides availability. */
export type Schedule = Pick<
  BookingConfig,
  | "timeZone"
  | "workingHours"
  | "slotLengthMinutes"
  | "bufferMinutes"
  | "minimumNoticeMinutes"
  | "bookingHorizonDays"
  | "blockedDates"
>;

/** A calendar day in the host time zone, formatted YYYY-MM-DD. */
export type DayKey = string;

export function isDayKey(value: unknown): value is DayKey {
  return isCalendarDate(value);
}

function parseDayKey(day: DayKey): { year: number; month: number; date: number } {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, date };
}

/**
 * The UTC instant at which `minutes` past midnight on `day` occurs in the host
 * time zone. `minutes` may be 1440 (end of day), which rolls into the next day.
 */
export function instantAt(day: DayKey, minutes: number, timeZone: string): Date {
  const { year, month, date } = parseDayKey(day);
  const tz = new TZDate(
    year,
    month - 1,
    date,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
    timeZone,
  );
  return new Date(tz.getTime());
}

/**
 * False for a wall-clock time that a daylight saving change skips, such as
 * 02:30 on the night the clocks go forward. Such a time resolves to an instant
 * one hour later, which would otherwise be offered twice.
 */
function wallTimeExists(day: DayKey, minutes: number, timeZone: string): boolean {
  const back = new TZDate(instantAt(day, minutes, timeZone).getTime(), timeZone);
  return (
    toDayKey(back, timeZone) === day && back.getHours() * 60 + back.getMinutes() === minutes
  );
}

/** The host weekday index (0 = Sunday) for a calendar day. */
export function weekdayOf(day: DayKey, timeZone: string): number {
  const { year, month, date } = parseDayKey(day);
  return new TZDate(year, month - 1, date, 12, 0, 0, 0, timeZone).getDay();
}

/** The host calendar day containing a UTC instant. */
export function toDayKey(instant: Date, timeZone: string): DayKey {
  const tz = new TZDate(instant.getTime(), timeZone);
  const year = tz.getFullYear();
  const month = String(tz.getMonth() + 1).padStart(2, "0");
  const date = String(tz.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

/** Today's calendar day in the host time zone. */
export function todayKey(schedule: Schedule, now: Date = new Date()): DayKey {
  return toDayKey(now, schedule.timeZone);
}

export function addDays(day: DayKey, amount: number, timeZone: string): DayKey {
  const { year, month, date } = parseDayKey(day);
  const shifted = new TZDate(year, month - 1, date + amount, 12, 0, 0, 0, timeZone);
  return toDayKey(new Date(shifted.getTime()), timeZone);
}

/** An existing commitment that blocks overlapping slots. */
export interface Busy {
  startsAt: number;
  endsAt: number;
}

/**
 * True when [startMs, endMs) comes closer than `bufferMs` to a commitment.
 * With no buffer this is a plain overlap test.
 */
export function conflicts(
  startMs: number,
  endMs: number,
  busy: Busy,
  bufferMs: number,
): boolean {
  return startMs < busy.endsAt + bufferMs && busy.startsAt - bufferMs < endMs;
}

/**
 * Every bookable start instant on `day` for a meeting of `durationMinutes`, as
 * epoch milliseconds in ascending order. A slot qualifies only if it fits
 * entirely inside one working-hours window, clears the minimum notice, and
 * keeps the buffer from everything already booked.
 */
export function slotsForDay(
  schedule: Schedule,
  day: DayKey,
  durationMinutes: number,
  busy: readonly Busy[],
  now: Date = new Date(),
): number[] {
  if (schedule.blockedDates.includes(day)) return [];

  const { timeZone } = schedule;
  const earliest = now.getTime() + schedule.minimumNoticeMinutes * 60_000;
  const bufferMs = schedule.bufferMinutes * 60_000;
  const slots = new Set<number>();

  for (const [windowStart, windowEnd] of windowsForWeekday(schedule, weekdayOf(day, timeZone))) {
    // Compared as an instant too: on a day when the clocks change, a meeting
    // that fits by wall-clock arithmetic can still run past the window.
    const windowEndMs = instantAt(day, windowEnd, timeZone).getTime();

    for (
      let minutes = windowStart;
      minutes + durationMinutes <= windowEnd;
      minutes += schedule.slotLengthMinutes
    ) {
      if (!wallTimeExists(day, minutes, timeZone)) continue;

      const startMs = instantAt(day, minutes, timeZone).getTime();
      const endMs = startMs + durationMinutes * 60_000;

      if (endMs > windowEndMs) continue;
      if (startMs < earliest) continue;
      if (busy.some((b) => conflicts(startMs, endMs, b, bufferMs))) continue;

      slots.add(startMs);
    }
  }

  return [...slots].sort((a, b) => a - b);
}

/** The last day that may be booked. */
export function horizonKey(schedule: Schedule, now: Date = new Date()): DayKey {
  return addDays(todayKey(schedule, now), schedule.bookingHorizonDays, schedule.timeZone);
}

export function isWithinHorizon(
  schedule: Schedule,
  day: DayKey,
  now: Date = new Date(),
): boolean {
  return day >= todayKey(schedule, now) && day <= horizonKey(schedule, now);
}

/**
 * The instants bounding `day`, widened by the buffer so that a booking just
 * across midnight still blocks the slots next to it.
 */
export function busyRangeFor(
  schedule: Schedule,
  firstDay: DayKey,
  lastDay: DayKey = firstDay,
): { from: number; to: number } {
  const bufferMs = schedule.bufferMinutes * 60_000;
  return {
    from: instantAt(firstDay, 0, schedule.timeZone).getTime() - bufferMs,
    to: instantAt(addDays(lastDay, 1, schedule.timeZone), 0, schedule.timeZone).getTime() + bufferMs,
  };
}
