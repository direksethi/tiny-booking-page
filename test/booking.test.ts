import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import config from "@config";
import { conflicts, instantAt, slotsForDay } from "@/lib/availability";
import { configProblems } from "@/lib/config";
import { buildIcs } from "@/lib/ics";
import { type NewBooking, createStore } from "@/lib/store";

const HOUR = 60 * 60_000;

function booking(startsAt: number, email = "guest@example.com"): NewBooking {
  return {
    startsAt,
    endsAt: startsAt + 30 * 60_000,
    meetingTypeId: "intro",
    meetingTypeName: "Introduction",
    durationMinutes: 30,
    location: "online",
    place: null,
    name: "Guest Example",
    email,
    notes: null,
    guestTz: "UTC",
  };
}

const rules = { bufferMs: 15 * 60_000, maxPerHour: 20, maxUpcomingPerEmail: 3 };

describe("example config", () => {
  it("is valid", () => {
    expect(configProblems(config)).toEqual([]);
  });
});

describe("slots", () => {
  const schedule = { ...config, timeZone: "Europe/London", blockedDates: [] };
  const longAgo = new Date("2026-01-01T00:00:00Z");

  it("follows local working hours across a daylight saving change", () => {
    // Clocks in London go forward on 2026-03-29. Both days are Mondays or Fridays in the example hours.
    const before = slotsForDay(schedule, "2026-03-27", 30, [], longAgo);
    const after = slotsForDay(schedule, "2026-03-30", 30, [], longAgo);
    expect(new Date(before[0]).toISOString()).toBe("2026-03-27T09:00:00.000Z");
    expect(new Date(after[0]).toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });

  it("offers nothing on a day with no working hours or a blocked date", () => {
    expect(slotsForDay(schedule, "2026-03-28", 30, [], longAgo)).toEqual([]);
    expect(
      slotsForDay({ ...schedule, blockedDates: ["2026-03-30"] }, "2026-03-30", 30, [], longAgo),
    ).toEqual([]);
  });

  it("keeps the buffer around an existing booking", () => {
    const taken = instantAt("2026-03-30", 10 * 60, "Europe/London").getTime();
    const busy = [{ startsAt: taken, endsAt: taken + 30 * 60_000 }];
    const slots = slotsForDay(schedule, "2026-03-30", 30, busy, longAgo);
    const bufferMs = schedule.bufferMinutes * 60_000;
    for (const start of slots) {
      expect(conflicts(start, start + 30 * 60_000, busy[0], bufferMs)).toBe(false);
    }
    expect(slots).not.toContain(taken);
  });

  it("respects the minimum notice", () => {
    const now = instantAt("2026-03-30", 9 * 60, "Europe/London");
    const slots = slotsForDay(schedule, "2026-03-30", 30, [], now);
    expect(slots[0]).toBeGreaterThanOrEqual(now.getTime() + schedule.minimumNoticeMinutes * 60_000);
  });
});

describe("store", () => {
  it("accepts one of two simultaneous requests for the same slot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "booking-"));
    const file = join(dir, "bookings.json");
    const store = createStore(file);
    const start = Date.now() + 48 * HOUR;

    const results = await Promise.all([
      store.create(booking(start, "a@example.com"), rules),
      store.create(booking(start, "b@example.com"), rules),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ reason: "conflict" });

    const saved = JSON.parse(await readFile(file, "utf8"));
    expect(saved).toHaveLength(1);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("limits upcoming bookings per email address", async () => {
    const dir = await mkdtemp(join(tmpdir(), "booking-"));
    const store = createStore(join(dir, "bookings.json"));
    const start = Date.now() + 48 * HOUR;
    for (let i = 0; i < 3; i++) {
      expect((await store.create(booking(start + i * 2 * HOUR), rules)).ok).toBe(true);
    }
    expect(await store.create(booking(start + 8 * HOUR), rules)).toMatchObject({
      ok: false,
      reason: "email_limit",
    });
  });
});

describe("ics", () => {
  it("builds a folded, escaped invite", () => {
    const ics = buildIcs({
      id: "abc",
      startsAt: Date.UTC(2026, 2, 30, 8, 0),
      endsAt: Date.UTC(2026, 2, 30, 8, 30),
      durationMinutes: 30,
      createdAt: Date.UTC(2026, 2, 1),
      title: "Introduction; with, punctuation",
      businessName: "Acme Studio",
      hostName: "Alex Example",
      hostEmail: "alex@example.com",
      guestName: "Guest Example",
      guestEmail: "guest@example.com",
      locationText: "Online",
      videoUrl: "https://meet.example.com/acme-studio-abc",
      notes: null,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20260330T080000Z");
    expect(ics).toContain("DTEND:20260330T083000Z");
    expect(ics).toContain("Introduction\; with\\, punctuation");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
