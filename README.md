# tiny-booking-page

A booking page you own, in one small codebase. A visitor picks a meeting type, a day and a time; the slot is held; both sides get an email with a calendar invite. There is no database, no account system and no third-party scheduling service: bookings live in one JSON file and email goes through Resend.

It exists for the case where a hosted scheduler is more than you need: one person, a few meeting types, fixed working hours.

## Features

- Meeting types with their own durations, online and in-person locations.
- Working hours per weekday with any number of ranges, blocked dates, a buffer around every booking, a minimum notice and a booking horizon.
- Working hours are defined in the host's time zone and shown to each visitor in their own, including across daylight saving changes.
- A calendar invite (`.ics`) attached to both emails, and an optional video link generated per booking.
- Double-booking protection: the server recomputes the offered slots for every request and writes inside a lock, so two simultaneous requests for one slot cannot both succeed.
- Abuse limits: a hidden form field for automated clients, a cap on bookings per hour, a cap on upcoming bookings per email address, and an optional per-IP limit.
- Everything is configured in one typed file.

## Quick start

Requires Node.js 22 or later.

```sh
git clone https://github.com/direksethi/tiny-booking-page.git
cd tiny-booking-page
npm install
EMAIL_DRY_RUN=1 npm run dev
```

Open http://localhost:3200. With `EMAIL_DRY_RUN=1` emails are logged instead of sent, so no Resend account is needed to try it. Bookings are written to `data/bookings.json`.

## Configuration

Edit `booking.config.ts`. The file is type checked and validated at startup.

| Key | Meaning |
| --- | --- |
| `businessName`, `pageTitle` | Shown on the page, in emails and in invites. |
| `host` | Name and email of the person being booked. Receives a notification for every booking. |
| `sender` | From address for all email. Must belong to a domain verified in Resend. |
| `timeZone` | IANA time zone in which working hours and blocked dates are expressed. |
| `workingHours` | Bookable ranges for each weekday. An empty list closes the day. |
| `slotLengthMinutes` | Interval between offered start times. |
| `bufferMinutes` | Gap kept free before and after every booking. |
| `minimumNoticeMinutes` | How soon the earliest bookable slot can be. |
| `bookingHorizonDays` | How far ahead a visitor can book. |
| `meetingTypes` | At least one, each with an id, a name and a duration. |
| `locations` | `online`, `in_person`, or both. |
| `videoLinkTemplate` | Link sent for online meetings. `{id}` becomes the booking ID. `null` sends no link. |
| `blockedDates` | Dates with no availability, as `YYYY-MM-DD` in the host time zone. |
| `accentColor`, `accentTextColor` | Accent of the page and emails. |
| `limits` | `bookingsPerHour`, `requestsPerIpPerHour`, `upcomingBookingsPerEmail`. |

Secrets and deployment settings are environment variables, see `.env.example`:

| Variable | Meaning |
| --- | --- |
| `RESEND_API_KEY` | Resend key used to send email. |
| `BOOKINGS_FILE` | Path of the bookings file. Required, and must be absolute, in production. |
| `EMAIL_DRY_RUN` | Set to `1` to log emails instead of sending them. |
| `TRUSTED_IP_HEADER` | Header your reverse proxy sets to the visitor's IP. Enables the per-IP limit. Leave unset when there is no proxy, since a client could forge the header. |

## Email

Create a [Resend](https://resend.com) account, verify your sending domain, and set `RESEND_API_KEY`. The host gets a notification with the visitor's details and notes; the visitor gets a confirmation. Both carry the invite. If the host notification fails, the booking is kept and the visitor is told that the confirmation email could not be sent.

## Storage and its limits

Bookings are one JSON file, written atomically (temporary file, then rename) with owner-only permissions, because it holds names, email addresses and notes.

- Run exactly one instance. The write lock lives in the process, so two processes sharing the file would not see each other's lock.
- The file needs a persistent disk. This does not fit serverless platforms with ephemeral filesystems.
- There is no admin interface. To cancel a booking, remove its entry from the file.
- The store is one module (`src/lib/store.ts`) behind a small interface, so replacing it with a database is contained.

## Deployment

A `Dockerfile` and `docker-compose.yml` are included. The compose file publishes the app on `127.0.0.1:3200` and keeps bookings on a named volume:

```sh
cp .env.example .env    # fill in RESEND_API_KEY
docker compose up -d --build
```

Put a reverse proxy or tunnel with TLS in front of it, and set `TRUSTED_IP_HEADER` to the header that proxy sets.

Without Docker: `npm run build`, then `npm start` with the environment variables set.

## Tests

```sh
npm test          # slot generation across a DST change, buffers, notice, double booking, limits, invite output
npm run typecheck
```

## Limitations

- One host and one calendar. It does not read your existing calendar, so block time you are busy with `blockedDates` or working hours.
- No rescheduling or cancellation links.
- The hourly and per-IP limits are held in memory and reset on restart.
- No CAPTCHA. The limits above are the only abuse controls.

## License

MIT, see [LICENSE](LICENSE). Built by [Direk Sethi](https://direksethi.com).
