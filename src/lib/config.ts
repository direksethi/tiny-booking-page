/**
 * Types and validation for the booking configuration.
 * The values themselves live in booking.config.ts at the repository root.
 */

/** Index matches the JavaScript weekday: 0 = Sunday. */
export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Wall-clock range in the host time zone, "HH:MM" to "HH:MM". End may be "24:00". */
export interface TimeRange {
  start: string;
  end: string;
}

export interface MeetingType {
  /** Stable identifier used in the API and stored with each booking. */
  id: string;
  /** Label shown to visitors and used in emails. */
  name: string;
  durationMinutes: number;
}

export const LOCATIONS = ["online", "in_person"] as const;
export type Location = (typeof LOCATIONS)[number];

export interface BookingConfig {
  /** Shown on the page, in emails and in calendar invites. */
  businessName: string;
  /** Heading of the booking page. */
  pageTitle: string;
  /** The person being booked. Receives a notification for every booking. */
  host: { name: string; email: string };
  /** From address for all email. Must belong to a domain verified in Resend. */
  sender: string;
  /** IANA time zone in which working hours and blocked dates are expressed. */
  timeZone: string;
  /** Bookable ranges for each weekday. An empty list closes the day. */
  workingHours: Record<Weekday, readonly TimeRange[]>;
  /** Interval between offered start times, in minutes. */
  slotLengthMinutes: number;
  /** Minimum gap kept free before and after every booking, in minutes. */
  bufferMinutes: number;
  /** Bookings must start at least this many minutes from now. */
  minimumNoticeMinutes: number;
  /** How many days ahead a visitor can book. */
  bookingHorizonDays: number;
  /** At least one. The first is selected by default. */
  meetingTypes: readonly MeetingType[];
  /** At least one. The first is selected by default. */
  locations: readonly Location[];
  /**
   * Link included for online meetings. "{id}" is replaced with the booking ID,
   * which gives every meeting its own room. Set to null to send no link.
   */
  videoLinkTemplate: string | null;
  /** Dates (YYYY-MM-DD, host time zone) with no availability. */
  blockedDates: readonly string[];
  /** Accent color of the page and emails, and the text color used on top of it. */
  accentColor: string;
  accentTextColor: string;
  /** Abuse limits. See the README for what each one does and does not cover. */
  limits: {
    /** Bookings accepted per hour across all visitors. */
    bookingsPerHour: number;
    /** Booking requests per hour from one IP address. Needs TRUSTED_IP_HEADER. */
    requestsPerIpPerHour: number;
    /** Upcoming bookings one email address may hold at a time. */
    upcomingBookingsPerEmail: number;
  };
}

/** Minutes from midnight, [start, end). End of day is 1440. */
export type Window = readonly [number, number];

const CLOCK_PATTERN = /^([01]\d|2[0-4]):([0-5]\d)$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

// The address grammar browsers use for <input type="email">, plus a required dot.
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** True for a YYYY-MM-DD string that names a real calendar date. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  const [year, month, date] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, date));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === date
  );
}

function parseClock(value: string): number | null {
  const match = CLOCK_PATTERN.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 1440 ? minutes : null;
}

/** Working-hour windows for a weekday index (0 = Sunday), in minutes from midnight. */
export function windowsForWeekday(
  config: Pick<BookingConfig, "workingHours">,
  weekday: number,
): Window[] {
  return config.workingHours[WEEKDAYS[weekday]].map(
    (range) => [parseClock(range.start) ?? 0, parseClock(range.end) ?? 0] as const,
  );
}

export function findMeetingType(
  config: Pick<BookingConfig, "meetingTypes">,
  id: unknown,
): MeetingType | null {
  if (typeof id !== "string") return null;
  return config.meetingTypes.find((type) => type.id === id) ?? null;
}

export function isLocation(
  config: Pick<BookingConfig, "locations">,
  value: unknown,
): value is Location {
  return config.locations.includes(value as Location);
}

/** The video link for a booking, or null when no template is configured. */
export function videoLinkFor(
  config: Pick<BookingConfig, "videoLinkTemplate">,
  bookingId: string,
): string | null {
  if (!config.videoLinkTemplate) return null;
  return config.videoLinkTemplate.replaceAll("{id}", encodeURIComponent(bookingId));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** The address part of "Name <address>" or a bare address. */
export function senderAddress(sender: string): string {
  const match = /<([^<>]+)>\s*$/.exec(sender);
  return (match ? match[1] : sender).trim();
}

/** Every problem found in a configuration, as readable sentences. */
export function configProblems(config: BookingConfig): string[] {
  const problems: string[] = [];

  if (!config.businessName.trim()) problems.push("businessName is empty.");
  if (!config.pageTitle.trim()) problems.push("pageTitle is empty.");
  if (!config.host.name.trim()) problems.push("host.name is empty.");
  if (!isEmailAddress(config.host.email)) {
    problems.push("host.email is not a valid email address.");
  }
  if (/[\r\n]/.test(config.sender) || !isEmailAddress(senderAddress(config.sender))) {
    problems.push('sender must be "Name <address>" or a bare email address.');
  }
  if (!isTimeZone(config.timeZone)) {
    problems.push(`timeZone "${config.timeZone}" is not an IANA time zone.`);
  }

  for (const weekday of WEEKDAYS) {
    const ranges = config.workingHours[weekday];
    if (!Array.isArray(ranges)) {
      problems.push(`workingHours.${weekday} must be a list of ranges.`);
      continue;
    }
    let previousEnd = -1;
    for (const range of ranges) {
      const start = parseClock(range.start);
      const end = parseClock(range.end);
      if (start === null || end === null) {
        problems.push(`workingHours.${weekday} has a time that is not HH:MM.`);
      } else if (start >= end) {
        problems.push(`workingHours.${weekday} has a range that ends before it starts.`);
      } else if (start < previousEnd) {
        problems.push(`workingHours.${weekday} ranges must be in order and must not overlap.`);
      } else {
        previousEnd = end;
      }
    }
  }

  if (!isPositiveInteger(config.slotLengthMinutes)) {
    problems.push("slotLengthMinutes must be a positive whole number.");
  }
  if (!isWholeNumber(config.bufferMinutes)) {
    problems.push("bufferMinutes must be zero or a positive whole number.");
  }
  if (!isWholeNumber(config.minimumNoticeMinutes)) {
    problems.push("minimumNoticeMinutes must be zero or a positive whole number.");
  }
  if (!isPositiveInteger(config.bookingHorizonDays) || config.bookingHorizonDays > 730) {
    problems.push("bookingHorizonDays must be a whole number from 1 to 730.");
  }

  if (config.meetingTypes.length === 0) problems.push("meetingTypes needs at least one entry.");
  const ids = new Set<string>();
  for (const type of config.meetingTypes) {
    if (!ID_PATTERN.test(type.id)) {
      problems.push(`Meeting type ID "${type.id}" must be lowercase letters, digits and hyphens.`);
    }
    if (ids.has(type.id)) problems.push(`Meeting type ID "${type.id}" is used twice.`);
    ids.add(type.id);
    if (!type.name.trim()) problems.push(`Meeting type "${type.id}" has no name.`);
    if (!isPositiveInteger(type.durationMinutes) || type.durationMinutes > 1440) {
      problems.push(`Meeting type "${type.id}" needs a duration from 1 to 1440 minutes.`);
    }
  }

  if (config.locations.length === 0) problems.push("locations needs at least one entry.");
  for (const location of config.locations) {
    if (!LOCATIONS.includes(location)) {
      problems.push(`Location "${location}" must be "online" or "in_person".`);
    }
  }

  if (config.videoLinkTemplate !== null) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(config.videoLinkTemplate.replaceAll("{id}", "id"));
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== "https:") {
      problems.push("videoLinkTemplate must be an https URL or null.");
    }
  }

  for (const date of config.blockedDates) {
    if (!isCalendarDate(date)) problems.push(`Blocked date "${date}" is not a YYYY-MM-DD date.`);
  }

  if (!COLOR_PATTERN.test(config.accentColor) || !COLOR_PATTERN.test(config.accentTextColor)) {
    problems.push("accentColor and accentTextColor must be six-digit hex colors.");
  }

  for (const [key, value] of Object.entries(config.limits)) {
    if (!isPositiveInteger(value)) problems.push(`limits.${key} must be a positive whole number.`);
  }

  return problems;
}

/** Validates the configuration when the app loads, so a mistake fails the build. */
export function defineConfig(config: BookingConfig): BookingConfig {
  const problems = configProblems(config);
  if (problems.length > 0) {
    throw new Error(`Invalid booking.config.ts:\n- ${problems.join("\n- ")}`);
  }
  return config;
}
