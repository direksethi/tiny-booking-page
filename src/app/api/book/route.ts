import { NextResponse } from "next/server";

import config from "@config";
import { busyRangeFor, isWithinHorizon, slotsForDay, toDayKey } from "@/lib/availability";
import { parseBookingRequest, readJsonBody } from "@/lib/booking";
import { videoLinkFor } from "@/lib/config";
import { sendBookingEmails } from "@/lib/email";
import { type RateLimiter, clientAddress, createRateLimiter } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60_000;

const globalLimiter = globalThis as typeof globalThis & { __bookingLimiter?: RateLimiter };

function limiter(): RateLimiter {
  globalLimiter.__bookingLimiter ??= createRateLimiter(
    config.limits.requestsPerIpPerHour,
    HOUR_MS,
  );
  return globalLimiter.__bookingLimiter;
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  // Requiring JSON keeps plain cross-site form posts out.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return fail(415, "The request must be JSON.");
  }

  // Applies only when TRUSTED_IP_HEADER names a header set by your proxy.
  const address = clientAddress(request.headers);
  if (address && !limiter().allow(address)) {
    return fail(429, "Too many booking attempts. Try again later.");
  }

  const body = await readJsonBody(request);
  if (body === undefined) return fail(400, "The request is not valid.");

  const parsed = parseBookingRequest(body, config);
  if (!parsed.ok) {
    return fail(400, parsed.error ?? "The request is not valid.");
  }
  const { startsAt, meetingType, location, name, email, place, notes, guestTz } = parsed.value;

  try {
    const store = getStore();

    // Re-derive the slot on the server: never trust that the posted time is bookable.
    const now = new Date();
    const day = toDayKey(new Date(startsAt), config.timeZone);
    if (!isWithinHorizon(config, day, now)) {
      return fail(409, "That date is not available.");
    }

    const { from, to } = busyRangeFor(config, day);
    const offered = slotsForDay(
      config,
      day,
      meetingType.durationMinutes,
      await store.busyBetween(from, to),
      now,
    );
    if (!offered.includes(startsAt)) {
      return fail(409, "That time is no longer available. Select another time.");
    }

    const endsAt = startsAt + meetingType.durationMinutes * 60_000;
    const result = await store.create(
      {
        startsAt,
        endsAt,
        meetingTypeId: meetingType.id,
        meetingTypeName: meetingType.name,
        durationMinutes: meetingType.durationMinutes,
        location,
        place,
        name,
        email,
        notes,
        guestTz,
      },
      {
        bufferMs: config.bufferMinutes * 60_000,
        maxPerHour: config.limits.bookingsPerHour,
        maxUpcomingPerEmail: config.limits.upcomingBookingsPerEmail,
        videoUrlFor: (id) => videoLinkFor(config, id),
        now: now.getTime(),
      },
    );

    if (!result.ok) {
      if (result.reason === "conflict") {
        return fail(409, "That time was just taken. Select another time.");
      }
      if (result.reason === "email_limit") {
        return fail(429, "This email address has reached the limit for upcoming bookings.");
      }
      return fail(429, "Bookings are temporarily unavailable. Try again later.");
    }

    const { booking } = result;
    let emailed = true;
    try {
      await sendBookingEmails(config, booking);
    } catch (error) {
      // The slot is held. Report the failure rather than implying all is well.
      console.error("[book] email delivery failed", error);
      emailed = false;
    }

    return NextResponse.json({
      id: booking.id,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      videoUrl: booking.videoUrl,
      emailed,
    });
  } catch (error) {
    console.error("[book] booking failed", error);
    return fail(500, "The booking could not be saved. Try again later.");
  }
}
