import { NextResponse } from "next/server";

import config from "@config";
import {
  type DayKey,
  busyRangeFor,
  isDayKey,
  isWithinHorizon,
  slotsForDay,
  todayKey,
} from "@/lib/availability";
import { findMeetingType } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Every day in a YYYY-MM month. */
function daysInMonth(month: string): DayKey[] {
  const [year, monthIndex] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days: DayKey[] = [];
  for (let d = 1; d <= count; d += 1) {
    days.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const meetingType = findMeetingType(config, params.get("type"));
  if (!meetingType) {
    return NextResponse.json({ error: "Unknown meeting type." }, { status: 400 });
  }

  const now = new Date();
  const day = params.get("day");
  const month = params.get("month");

  try {
    if (day) {
      if (!isDayKey(day)) {
        return NextResponse.json({ error: "Invalid day." }, { status: 400 });
      }
      if (!isWithinHorizon(config, day, now)) {
        return NextResponse.json({ slots: [] });
      }

      const { from, to } = busyRangeFor(config, day);
      const busy = await getStore().busyBetween(from, to);
      const slots = slotsForDay(config, day, meetingType.durationMinutes, busy, now);
      return NextResponse.json({ slots });
    }

    if (month && MONTH_PATTERN.test(month)) {
      // Clamped to the booking horizon, so one request never scans more than a month.
      const days = daysInMonth(month).filter((d) => isWithinHorizon(config, d, now));
      const counts: Record<DayKey, number> = {};

      if (days.length > 0) {
        const { from, to } = busyRangeFor(config, days[0], days[days.length - 1]);
        const busy = await getStore().busyBetween(from, to);
        for (const d of days) {
          const count = slotsForDay(config, d, meetingType.durationMinutes, busy, now).length;
          if (count > 0) counts[d] = count;
        }
      }

      return NextResponse.json({ days: counts, today: todayKey(config, now) });
    }
  } catch (error) {
    console.error("[slots] availability failed", error);
    return NextResponse.json({ error: "Availability could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ error: "Specify a day or a month." }, { status: 400 });
}
