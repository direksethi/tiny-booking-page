import { defineConfig } from "./src/lib/config";

/**
 * Everything about your booking page is set here. The values below are
 * examples: replace them with your own, then rebuild.
 * Secrets do not belong in this file. See .env.example.
 */
export default defineConfig({
  businessName: "Acme Studio",
  pageTitle: "Book a meeting",

  host: {
    name: "Alex Example",
    email: "alex@example.com",
  },

  // Must use a domain you have verified in Resend.
  sender: "Acme Studio <bookings@example.com>",

  // Working hours and blocked dates are read in this time zone.
  // Visitors see times in their own.
  timeZone: "Europe/London",

  workingHours: {
    monday: [
      { start: "09:00", end: "12:30" },
      { start: "13:30", end: "17:00" },
    ],
    tuesday: [
      { start: "09:00", end: "12:30" },
      { start: "13:30", end: "17:00" },
    ],
    wednesday: [
      { start: "09:00", end: "12:30" },
      { start: "13:30", end: "17:00" },
    ],
    thursday: [
      { start: "09:00", end: "12:30" },
      { start: "13:30", end: "17:00" },
    ],
    friday: [{ start: "09:00", end: "15:00" }],
    saturday: [],
    sunday: [],
  },

  slotLengthMinutes: 30,
  bufferMinutes: 15,
  minimumNoticeMinutes: 120,
  bookingHorizonDays: 60,

  meetingTypes: [
    { id: "intro", name: "Introduction", durationMinutes: 30 },
    { id: "consultation", name: "Consultation", durationMinutes: 60 },
    { id: "workshop", name: "Workshop", durationMinutes: 120 },
  ],

  locations: ["online", "in_person"],

  // "{id}" becomes the booking ID. Use null to send no link.
  videoLinkTemplate: "https://meet.example.com/acme-studio-{id}",

  blockedDates: ["2026-12-25", "2027-01-01"],

  accentColor: "#1f2937",
  accentTextColor: "#ffffff",

  limits: {
    bookingsPerHour: 20,
    requestsPerIpPerHour: 10,
    upcomingBookingsPerEmail: 3,
  },
});
