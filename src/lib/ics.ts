import { durationLabel } from "./format";

/** What an invite needs. Deliberately independent of the stored booking shape. */
export interface InviteDetails {
  id: string;
  startsAt: number;
  endsAt: number;
  durationMinutes: number;
  createdAt: number;
  title: string;
  businessName: string;
  hostName: string;
  hostEmail: string;
  guestName: string;
  guestEmail: string;
  locationText: string;
  videoUrl: string | null;
  /** Left out of the copy sent to the guest address. */
  notes: string | null;
}

/** Escapes a TEXT value (RFC 5545, section 3.3.11). */
export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    // No other control character may appear in a content line.
    .replace(/[\u0000-\u001f\u007f]/g, " ");
}

/**
 * A quoted parameter value. A parameter cannot contain a double quote or a
 * line break at all, so those are removed rather than escaped.
 */
function icsParam(value: string): string {
  return `"${value.replace(/["\u0000-\u001f\u007f]/g, " ").trim()}"`;
}

/** UTC timestamp in the basic format, for example 20260309T090000Z. */
export function icsStamp(instant: number): string {
  return new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Folds a content line at 75 octets without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let octets = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    // Continuation lines start with a space, which counts toward the limit.
    const limit = parts.length === 0 ? 75 : 74;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += character;
    octets += size;
  }
  parts.push(current);

  return parts.join("\r\n ");
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/** A single-event calendar invite with the host as organizer. */
export function buildIcs(invite: InviteDetails): string {
  const description = [
    `Name: ${invite.guestName}`,
    `Email: ${invite.guestEmail}`,
    `Duration: ${durationLabel(invite.durationMinutes)}`,
    `Location: ${invite.locationText}`,
    invite.videoUrl ? `Link: ${invite.videoUrl}` : null,
    invite.notes ? `Notes: ${invite.notes}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tiny-booking-page//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${invite.id}@${domainOf(invite.hostEmail)}`,
    `DTSTAMP:${icsStamp(invite.createdAt)}`,
    `DTSTART:${icsStamp(invite.startsAt)}`,
    `DTEND:${icsStamp(invite.endsAt)}`,
    `SUMMARY:${icsEscape(`${invite.title}: ${invite.guestName} and ${invite.businessName}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(invite.videoUrl ?? invite.locationText)}`,
    invite.videoUrl ? `URL:${invite.videoUrl}` : null,
    `ORGANIZER;CN=${icsParam(invite.hostName)}:mailto:${invite.hostEmail}`,
    `ATTENDEE;CN=${icsParam(invite.guestName)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${invite.guestEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return (
    lines
      .filter((line): line is string => line !== null)
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
