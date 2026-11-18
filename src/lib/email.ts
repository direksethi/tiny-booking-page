import { Resend } from "resend";

import type { BookingConfig, Location } from "./config";
import { durationLabel, formatRange, sameWallClock, zoneLabel } from "./format";
import { buildIcs } from "./ics";
import type { Booking } from "./store";

type EmailConfig = Pick<
  BookingConfig,
  "businessName" | "pageTitle" | "host" | "sender" | "timeZone" | "accentColor"
>;

export function locationText(location: Location, place: string | null): string {
  if (location === "online") return "Online";
  return place ? `In person, ${place}` : "In person, place to be confirmed";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 16px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap;vertical-align:top">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;vertical-align:top">${value}</td>
  </tr>`;
}

function link(href: string, text: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#111827">${escapeHtml(text)}</a>`;
}

function shell(accent: string, heading: string, rows: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f8;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
    <tr><td style="padding:24px 24px 0">
      <div style="display:inline-block;width:28px;height:28px;border-radius:8px;background:${accent}"></div>
      <div style="margin-top:16px;font-size:16px;font-weight:600;color:#111827">${heading}</div>
    </td></tr>
    <tr><td style="padding:16px 24px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${rows}</table>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px">${footer}</div>
    </td></tr>
  </table></body></html>`;
}

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  attachments: { filename: string; content: string; contentType: string }[];
}

/** The host notification and the guest confirmation, ready to send. */
export function buildBookingEmails(
  config: EmailConfig,
  booking: Booking,
): { host: OutgoingEmail; guest: OutgoingEmail } {
  const hostWhen = formatRange(booking.startsAt, booking.endsAt, config.timeZone);
  const guestWhen = formatRange(booking.startsAt, booking.endsAt, booking.guestTz);
  const differentZone = !sameWallClock(booking.startsAt, booking.guestTz, config.timeZone);
  const where = locationText(booking.location, booking.place);

  const invite = {
    id: booking.id,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    durationMinutes: booking.durationMinutes,
    createdAt: booking.createdAt,
    title: booking.meetingTypeName,
    businessName: config.businessName,
    hostName: config.host.name,
    hostEmail: config.host.email,
    guestName: booking.name,
    guestEmail: booking.email,
    locationText: where,
    videoUrl: booking.videoUrl,
  };
  const attachment = (notes: string | null) => [
    {
      filename: "meeting.ics",
      content: Buffer.from(buildIcs({ ...invite, notes })).toString("base64"),
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
    },
  ];

  const videoRow = booking.videoUrl ? row("Link", link(booking.videoUrl, booking.videoUrl)) : "";

  const hostRows = [
    row("When", `${escapeHtml(hostWhen)} ${zoneLabel(booking.startsAt, config.timeZone)}`),
    differentZone
      ? row(
          "Guest time",
          `${escapeHtml(guestWhen)} ${zoneLabel(booking.startsAt, booking.guestTz)}`,
        )
      : "",
    row("Meeting", escapeHtml(booking.meetingTypeName)),
    row("Duration", durationLabel(booking.durationMinutes)),
    row("Location", escapeHtml(where)),
    videoRow,
    row("Name", escapeHtml(booking.name)),
    row("Email", link(`mailto:${booking.email}`, booking.email)),
    booking.notes ? row("Notes", escapeHtml(booking.notes).replace(/\n/g, "<br>")) : "",
  ].join("");

  // The guest address is unverified, so this message carries no free text
  // beyond the place: the notes stay out of it and out of its invite.
  const guestRows = [
    row("When", `${escapeHtml(guestWhen)} ${zoneLabel(booking.startsAt, booking.guestTz)}`),
    row("Meeting", escapeHtml(booking.meetingTypeName)),
    row("Duration", durationLabel(booking.durationMinutes)),
    row("With", escapeHtml(`${config.host.name}, ${config.businessName}`)),
    row("Location", escapeHtml(where)),
    videoRow,
  ].join("");

  return {
    host: {
      from: config.sender,
      to: config.host.email,
      replyTo: booking.email,
      subject: `New booking: ${booking.meetingTypeName} with ${booking.name}, ${hostWhen}`,
      html: shell(
        config.accentColor,
        "New booking",
        hostRows,
        "Reply to this email to contact the guest.",
      ),
      attachments: attachment(booking.notes),
    },
    guest: {
      from: config.sender,
      to: booking.email,
      replyTo: config.host.email,
      subject: `Confirmed: ${booking.meetingTypeName} with ${config.businessName}`,
      html: shell(
        config.accentColor,
        "Your meeting is confirmed",
        guestRows,
        "To reschedule or cancel, reply to this email.",
      ),
      attachments: attachment(null),
    },
  };
}

/**
 * Notify the host and confirm to the guest. Throws when the host notification
 * cannot be sent, so the booking route can report it instead of implying that
 * everything went through.
 *
 * With EMAIL_DRY_RUN=1 nothing is sent: each message is logged instead.
 */
export async function sendBookingEmails(config: EmailConfig, booking: Booking): Promise<void> {
  const emails = buildBookingEmails(config, booking);

  if (process.env.EMAIL_DRY_RUN === "1") {
    for (const email of [emails.host, emails.guest]) {
      console.log(
        `[email] dry run, not sent: to=${email.to} subject=${JSON.stringify(email.subject)} attachments=${email.attachments.length}`,
      );
    }
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  const [hostResult, guestResult] = await Promise.all([
    resend.emails.send(emails.host),
    resend.emails.send(emails.guest),
  ]);

  // The host notification is the one that must not be lost.
  if (hostResult.error) {
    throw new Error(`Resend rejected the host notification: ${hostResult.error.message}`);
  }
  if (guestResult.error) {
    console.error("[email] guest confirmation failed", guestResult.error);
  }
}
