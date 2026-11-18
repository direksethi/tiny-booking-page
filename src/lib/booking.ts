import {
  type BookingConfig,
  type Location,
  type MeetingType,
  findMeetingType,
  isEmailAddress,
  isLocation,
  isTimeZone,
} from "./config";

/** Request validation for the booking endpoint. Nothing here touches storage. */

export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_NAME = 120;
export const MAX_PLACE = 200;
export const MAX_NOTES = 2000;

export interface BookingRequest {
  startsAt: number;
  meetingType: MeetingType;
  location: Location;
  name: string;
  email: string;
  place: string | null;
  notes: string | null;
  guestTz: string;
}

export type ParseResult =
  | { ok: true; value: BookingRequest }
  | { ok: false; error: string }
  /** The hidden field was filled in, which only an automated client does. */
  | { ok: false; error: null; bot: true };

/** Removes control characters and collapses whitespace to single spaces. */
function singleLine(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keeps line breaks, removes every other control character. */
function multiLine(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, " ")
    .trim();
}

function optionalText(
  value: unknown,
  clean: (value: string) => string,
): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  return clean(value) || null;
}

export function parseBookingRequest(
  body: unknown,
  config: Pick<BookingConfig, "meetingTypes" | "locations" | "timeZone">,
): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "The request is not valid." };
  }
  const input = body as Record<string, unknown>;

  // Real visitors never see this field. See DetailsForm.
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: false, error: null, bot: true };
  }

  const { startsAt } = input;
  if (typeof startsAt !== "number" || !Number.isSafeInteger(startsAt) || startsAt <= 0) {
    return { ok: false, error: "Select a time." };
  }

  const meetingType = findMeetingType(config, input.meetingTypeId);
  if (!meetingType) return { ok: false, error: "Select a meeting type." };

  const { location } = input;
  if (!isLocation(config, location)) return { ok: false, error: "Select a location." };

  const name = optionalText(input.name, singleLine);
  if (!name) return { ok: false, error: "Enter your name." };
  if (name.length > MAX_NAME) {
    return { ok: false, error: `Name must be ${MAX_NAME} characters or fewer.` };
  }

  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!isEmailAddress(email)) return { ok: false, error: "Enter a valid email address." };

  const place = location === "in_person" ? optionalText(input.place, singleLine) : null;
  if (place === undefined) return { ok: false, error: "The request is not valid." };
  if (place && place.length > MAX_PLACE) {
    return { ok: false, error: `Place must be ${MAX_PLACE} characters or fewer.` };
  }

  const notes = optionalText(input.notes, multiLine);
  if (notes === undefined) return { ok: false, error: "The request is not valid." };
  if (notes && notes.length > MAX_NOTES) {
    return { ok: false, error: `Notes must be ${MAX_NOTES} characters or fewer.` };
  }

  // Only used to show the guest their own local time. Fall back, do not reject.
  const guestTz = isTimeZone(input.guestTz) ? input.guestTz : config.timeZone;

  return {
    ok: true,
    value: { startsAt, meetingType, location, name, email, place, notes, guestTz },
  };
}

/**
 * Reads a request body as JSON, refusing anything over MAX_BODY_BYTES before
 * it is buffered in full. Returns undefined when the body is too large or is
 * not JSON.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES || !request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}
