"use client";

import { Check } from "lucide-react";

import type { Location } from "@/lib/config";
import { durationLabel, formatRange, zoneLabel } from "@/lib/format";

interface ConfirmedProps {
  startsAt: number;
  endsAt: number;
  meetingName: string;
  durationMinutes: number;
  location: Location;
  place: string;
  videoUrl: string | null;
  email: string;
  timeZone: string;
  hostName: string;
  emailed: boolean;
}

function locationText(location: Location, place: string): string {
  if (location === "online") return "Online";
  return place.trim() ? `In person, ${place.trim()}` : "In person, place to be confirmed";
}

function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={["flex justify-between gap-4", last ? "" : "border-b border-line pb-2"].join(" ")}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[13px] font-medium">{children}</dd>
    </div>
  );
}

export function Confirmed({
  startsAt,
  endsAt,
  meetingName,
  durationMinutes,
  location,
  place,
  videoUrl,
  email,
  timeZone,
  hostName,
  emailed,
}: ConfirmedProps) {
  return (
    <div className="px-6 py-10 text-center sm:px-8">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent">
        <Check size={20} strokeWidth={2.5} className="text-accent-ink" />
      </div>

      <h2 className="mt-4 text-base font-semibold">Booking confirmed</h2>

      <dl className="mx-auto mt-5 max-w-sm space-y-2 text-left">
        <Row label="When">
          <span className="tabular-nums">{formatRange(startsAt, endsAt, timeZone)}</span>
        </Row>
        <Row label="Time zone">
          {timeZone} ({zoneLabel(startsAt, timeZone)})
        </Row>
        <Row label="Meeting">
          {meetingName}, {durationLabel(durationMinutes)}
        </Row>
        <Row label="With">{hostName}</Row>
        <Row label="Location" last={!videoUrl}>
          {locationText(location, place)}
        </Row>
        {videoUrl && (
          <Row label="Link" last>
            <a href={videoUrl} className="underline underline-offset-2" rel="noreferrer">
              {videoUrl}
            </a>
          </Row>
        )}
      </dl>

      <p className="mt-5 text-[13px] text-muted">
        {emailed
          ? `A confirmation with a calendar invite has been sent to ${email}.`
          : `Your booking is saved, but the confirmation email could not be sent. Keep a note of these details.`}
      </p>
    </div>
  );
}
