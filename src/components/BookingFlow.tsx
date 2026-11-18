"use client";

import { Clock, MapPin, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Location, MeetingType } from "@/lib/config";
import { durationLabel, formatDate, zoneLabel } from "@/lib/format";

import { Calendar } from "./Calendar";
import { Confirmed } from "./Confirmed";
import { DetailsForm, type Details } from "./DetailsForm";
import { Segmented } from "./Segmented";
import { SlotList } from "./SlotList";

interface BookingFlowProps {
  /** Host-timezone anchors, resolved on the server so the first paint is correct. */
  todayKey: string;
  horizonKey: string;
  businessName: string;
  pageTitle: string;
  hostName: string;
  /** Used when the browser does not report a time zone. */
  hostTimeZone: string;
  meetingTypes: readonly MeetingType[];
  locations: readonly Location[];
}

type Step = "select" | "details" | "done";

interface Confirmation {
  startsAt: number;
  endsAt: number;
  meetingName: string;
  durationMinutes: number;
  location: Location;
  place: string;
  videoUrl: string | null;
  email: string;
  emailed: boolean;
}

const LOCATION_LABELS: Record<Location, string> = {
  online: "Online",
  in_person: "In person",
};

function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function BookingFlow({
  todayKey,
  horizonKey,
  businessName,
  pageTitle,
  hostName,
  hostTimeZone,
  meetingTypes,
  locations,
}: BookingFlowProps) {
  const [typeId, setTypeId] = useState(meetingTypes[0].id);
  const [location, setLocation] = useState<Location>(locations[0]);
  const meetingType = meetingTypes.find((type) => type.id === typeId) ?? meetingTypes[0];

  const typeOptions = useMemo(
    () =>
      meetingTypes.map((type) => ({
        value: type.id,
        label: type.name,
        detail: durationLabel(type.durationMinutes),
      })),
    [meetingTypes],
  );
  const locationOptions = useMemo(
    () => locations.map((value) => ({ value, label: LOCATION_LABELS[value] })),
    [locations],
  );
  const [month, setMonth] = useState(() => monthOf(todayKey));
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  const [available, setAvailable] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<number[]>([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [step, setStep] = useState<Step>("select");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || hostTimeZone,
    [hostTimeZone],
  );

  // Month availability, refetched whenever the meeting type or month changes.
  useEffect(() => {
    let cancelled = false;
    setMonthLoading(true);

    fetch(`/api/slots?month=${month}&type=${encodeURIComponent(typeId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setAvailable(data.days ?? {});
      })
      .catch(() => {
        if (!cancelled) setAvailable({});
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, typeId]);

  // Slots for the chosen day. Changing the meeting type invalidates the chosen time.
  useEffect(() => {
    if (!day) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);

    fetch(`/api/slots?day=${day}&type=${encodeURIComponent(typeId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [day, typeId]);

  const changeType = useCallback((value: string) => {
    setTypeId(value);
    setSlot(null);
  }, []);

  const submit = useCallback(
    async (details: Details) => {
      if (slot === null) return;
      setSubmitting(true);
      setError(null);

      try {
        const response = await fetch("/api/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startsAt: slot,
            meetingTypeId: typeId,
            location,
            guestTz: timeZone,
            ...details,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "The booking could not be completed. Try again.");
          if (response.status === 409) {
            // The slot went stale; pull fresh times.
            setStep("select");
            setSlot(null);
            setDay((current) => current);
          }
          return;
        }

        setConfirmation({
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          meetingName: meetingType.name,
          durationMinutes: meetingType.durationMinutes,
          location,
          place: details.place,
          videoUrl: data.videoUrl ?? null,
          email: details.email,
          emailed: data.emailed !== false,
        });
        setStep("done");
      } catch {
        setError("The server could not be reached. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [slot, typeId, meetingType, location, timeZone],
  );

  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-panel border border-line bg-surface shadow-sm">
      {step === "done" && confirmation ? (
        <Confirmed {...confirmation} timeZone={timeZone} hostName={hostName} />
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-line p-6 lg:border-b-0 lg:border-r">
            <div className="text-[13px] font-semibold text-muted">{businessName}</div>
            <h1 className="mt-2 text-lg font-semibold">{pageTitle}</h1>

            <div className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <Clock size={14} strokeWidth={2} />
                {durationLabel(meetingType.durationMinutes)}
              </span>
              <span className="flex items-center gap-1.5">
                {location === "online" ? (
                  <Video size={14} strokeWidth={2} />
                ) : (
                  <MapPin size={14} strokeWidth={2} />
                )}
                {LOCATION_LABELS[location]}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {typeOptions.length > 1 && (
                <Segmented
                  label="Meeting type"
                  options={typeOptions}
                  value={typeId}
                  onChange={changeType}
                  stacked
                />
              )}
              {locationOptions.length > 1 && (
                <Segmented
                  label="Location"
                  options={locationOptions}
                  value={location}
                  onChange={setLocation}
                />
              )}
            </div>
          </aside>

          <section className="p-6">
            {step === "select" ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_180px]">
                <Calendar
                  month={month}
                  onMonthChange={setMonth}
                  available={available}
                  selected={day}
                  onSelect={(next) => {
                    setDay(next);
                    setSlot(null);
                  }}
                  minMonth={monthOf(todayKey)}
                  maxMonth={monthOf(horizonKey)}
                  loading={monthLoading}
                />

                <div className="flex min-h-[260px] flex-col">
                  {day && (
                    <div className="mb-3 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {formatDate(
                          new Date(`${day}T12:00:00Z`).getTime(),
                          "UTC",
                        ).replace(/,? \d{4}$/, "")}
                      </span>
                      <span className="text-[11px] text-subtle">
                        {zoneLabel(Date.now(), timeZone)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto lg:max-h-[320px]">
                    <SlotList
                      slots={slots}
                      timeZone={timeZone}
                      selected={slot}
                      onSelect={setSlot}
                      loading={slotsLoading}
                      day={day}
                    />
                  </div>
                  {slot !== null && (
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      className="mt-3 w-full rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink"
                    >
                      Continue
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <DetailsForm
                location={location}
                submitting={submitting}
                error={error}
                onBack={() => {
                  setStep("select");
                  setError(null);
                }}
                onSubmit={submit}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
