export function formatTime(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(instant);
}

export function formatDate(instant: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(instant);
}

/** For example "Monday 9 March 2026, 09:00 to 09:30". */
export function formatRange(startsAt: number, endsAt: number, timeZone: string): string {
  return `${formatDate(startsAt, timeZone)}, ${formatTime(startsAt, timeZone)} to ${formatTime(endsAt, timeZone)}`;
}

/** Short zone label, for example "GMT+1". */
export function zoneLabel(instant: number, timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const whole = hours === 1 ? "1 hour" : `${hours} hours`;
  return rest === 0 ? whole : `${whole} ${rest} min`;
}

/** True when two zones show the same date and wall-clock time at an instant. */
export function sameWallClock(instant: number, zoneA: string, zoneB: string): boolean {
  return (
    formatTime(instant, zoneA) === formatTime(instant, zoneB) &&
    formatDate(instant, zoneA) === formatDate(instant, zoneB)
  );
}
