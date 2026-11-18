import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import { type Busy, conflicts } from "./availability";
import type { Location } from "./config";

/**
 * Bookings live in a single JSON file. One Node process owns the file, so an
 * in-process queue is a sufficient writer lock, and writing to a temporary
 * file before renaming keeps the file readable if the process dies mid-write.
 * Two processes sharing the file would not see each other's lock: run exactly
 * one instance, or replace this module with a real database.
 */

export interface Booking {
  id: string;
  startsAt: number;
  endsAt: number;
  meetingTypeId: string;
  meetingTypeName: string;
  durationMinutes: number;
  location: Location;
  place: string | null;
  videoUrl: string | null;
  name: string;
  email: string;
  notes: string | null;
  guestTz: string;
  createdAt: number;
}

export type NewBooking = Omit<Booking, "id" | "createdAt" | "videoUrl">;

export interface BookingRules {
  /** Gap kept free around every existing booking. */
  bufferMs: number;
  /** Bookings accepted per rolling hour, across all visitors. */
  maxPerHour: number;
  /** Upcoming bookings one email address may hold. */
  maxUpcomingPerEmail: number;
  /** Builds the video link once the booking ID is known. */
  videoUrlFor?: (id: string) => string | null;
  now?: number;
}

export type CreateResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "conflict" | "hourly_limit" | "email_limit" };

export interface BookingStore {
  /** Commitments overlapping [from, to), used to hide taken slots. */
  busyBetween(from: number, to: number): Promise<Busy[]>;
  /**
   * Insert a booking unless it collides with an existing one or exceeds a
   * limit. The checks and the write happen inside the same lock, so two
   * simultaneous requests for the same slot cannot both succeed.
   */
  create(booking: NewBooking, rules: BookingRules): Promise<CreateResult>;
  all(): Promise<readonly Booking[]>;
}

const HOUR_MS = 60 * 60_000;

function isBooking(value: unknown): value is Booking {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.email === "string" &&
    Number.isFinite(entry.startsAt) &&
    Number.isFinite(entry.endsAt) &&
    Number.isFinite(entry.createdAt)
  );
}

export function createStore(filePath: string): BookingStore {
  const path = resolve(filePath);
  let cache: Booking[] | null = null;
  let cacheMtimeMs = -1;

  /** Serialises read-modify-write cycles. */
  let queue: Promise<unknown> = Promise.resolve();

  function withLock<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    // Keep the chain alive regardless of individual failures.
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function mtimeMs(): Promise<number> {
    try {
      return (await stat(path)).mtimeMs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return -1;
      throw error;
    }
  }

  /** Reads the file, and reads it again whenever it changes on disk. */
  async function load(): Promise<Booking[]> {
    const current = await mtimeMs();
    if (cache && current === cacheMtimeMs) return cache;

    if (current === -1) {
      cache = [];
      cacheMtimeMs = -1;
      return cache;
    }

    // A file that cannot be understood must stop the app, not erase the schedule.
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(isBooking)) {
      throw new Error(`${path} is not a list of bookings`);
    }

    cache = parsed;
    cacheMtimeMs = current;
    return cache;
  }

  async function persist(bookings: Booking[]): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    // Owner-only: the file holds names, email addresses and notes.
    await writeFile(temp, JSON.stringify(bookings, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temp, path);
    cache = bookings;
    cacheMtimeMs = await mtimeMs();
  }

  return {
    async busyBetween(from, to) {
      const bookings = await load();
      return bookings
        .filter((b) => b.endsAt > from && b.startsAt < to)
        .map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt }));
    },

    create(booking, rules) {
      return withLock(async (): Promise<CreateResult> => {
        const bookings = await load();
        const now = rules.now ?? Date.now();

        const clash = bookings.some((existing) =>
          conflicts(booking.startsAt, booking.endsAt, existing, rules.bufferMs),
        );
        if (clash) return { ok: false, reason: "conflict" };

        const lastHour = bookings.filter((b) => b.createdAt > now - HOUR_MS).length;
        if (lastHour >= rules.maxPerHour) return { ok: false, reason: "hourly_limit" };

        const email = booking.email.toLowerCase();
        const upcoming = bookings.filter(
          (b) => b.endsAt > now && b.email.toLowerCase() === email,
        ).length;
        if (upcoming >= rules.maxUpcomingPerEmail) return { ok: false, reason: "email_limit" };

        const id = crypto.randomUUID();
        const created: Booking = {
          ...booking,
          id,
          videoUrl: booking.location === "online" ? (rules.videoUrlFor?.(id) ?? null) : null,
          createdAt: now,
        };

        await persist([...bookings, created]);
        return { ok: true, booking: created };
      });
    },

    async all() {
      return load();
    },
  };
}

/**
 * Where bookings are kept. In production the path must be set explicitly and
 * be absolute: the standalone server runs from inside the build output, so a
 * relative default would be deleted by the next build.
 */
export function bookingsFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.BOOKINGS_FILE?.trim();
  if (env.NODE_ENV === "production") {
    if (!configured || !isAbsolute(configured)) {
      throw new Error("BOOKINGS_FILE must be set to an absolute path in production");
    }
    return configured;
  }
  return resolve(configured || "data/bookings.json");
}

// One store per process, shared by every route, so they agree on the lock.
const globalStore = globalThis as typeof globalThis & { __bookingStore?: BookingStore };

export function getStore(): BookingStore {
  globalStore.__bookingStore ??= createStore(bookingsFilePath());
  return globalStore.__bookingStore;
}
