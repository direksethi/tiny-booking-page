"use client";

import { useState } from "react";

import type { Location } from "@/lib/config";

export interface Details {
  name: string;
  email: string;
  place: string;
  notes: string;
  /** Hidden field that only automated clients fill in. */
  website: string;
}

interface DetailsFormProps {
  location: Location;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (details: Details) => void;
}

const fieldClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle";

export function DetailsForm({
  location,
  submitting,
  error,
  onBack,
  onSubmit,
}: DetailsFormProps) {
  const [details, setDetails] = useState<Details>({
    name: "",
    email: "",
    place: "",
    notes: "",
    website: "",
  });

  function update<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  const ready = details.name.trim() !== "" && details.email.trim() !== "";

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !submitting) onSubmit(details);
      }}
    >
      <div>
        <label htmlFor="name" className="mb-1.5 block text-[13px] font-medium text-muted">
          Name
        </label>
        <input
          id="name"
          required
          maxLength={120}
          autoComplete="name"
          className={fieldClass}
          value={details.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          className={fieldClass}
          value={details.email}
          onChange={(event) => update("email", event.target.value)}
        />
      </div>

      {location === "in_person" && (
        <div>
          <label htmlFor="place" className="mb-1.5 block text-[13px] font-medium text-muted">
            Place
          </label>
          <input
            id="place"
            maxLength={200}
            className={fieldClass}
            placeholder="Optional"
            value={details.place}
            onChange={(event) => update("place", event.target.value)}
          />
        </div>
      )}

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-[13px] font-medium text-muted">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          maxLength={2000}
          className={`${fieldClass} resize-none`}
          value={details.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </div>

      {/* Not for people: kept out of view, the tab order and assistive technology. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={details.website}
          onChange={(event) => update("website", event.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-control border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-subtle"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!ready || submitting}
          className="flex-1 rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink transition-opacity disabled:opacity-40"
        >
          {submitting ? "Confirming…" : "Confirm booking"}
        </button>
      </div>
    </form>
  );
}
