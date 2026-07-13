"use client";

import { useState } from "react";

import type { ClientRelationshipPreferencesDto } from "@/lib/crm-v2/moments/types";

type Props = {
  initialPreferences: ClientRelationshipPreferencesDto | null;
  loadError: string | null;
};

export function ClientPreferencesClient({ initialPreferences, loadError }: Props) {
  const [preferences, setPreferences] = useState<ClientRelationshipPreferencesDto | null>(
    initialPreferences,
  );
  const [error, setError] = useState<string | null>(loadError);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [birthdayOptOut, setBirthdayOptOut] = useState(
    initialPreferences?.birthdayAcknowledgementOptOut ?? false,
  );
  const [festiveOptOut, setFestiveOptOut] = useState(
    initialPreferences?.festiveAcknowledgementOptOut ?? false,
  );

  async function refreshPreferences() {
    setError(null);
    try {
      const res = await fetch("/api/preferences", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.reason === "feature_disabled"
            ? "Relationship preferences are not enabled."
            : "Unable to load preferences.",
        );
        return;
      }
      setPreferences(data.preferences);
    } catch {
      setError("Unable to load preferences.");
    }
  }

  async function handleSaveOptOuts() {
    setActionMessage(null);
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferenceType: "birthday_acknowledgement_opt_out",
        proposedValue: { optOut: birthdayOptOut, festiveOptOut },
        idempotencyKey: `optout:${birthdayOptOut}:${festiveOptOut}`,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage("Failed to save preferences.");
      return;
    }
    setActionMessage("Preference update submitted for adviser review.");
    await refreshPreferences();
  }

  async function handleRequestReview() {
    setActionMessage(null);
    const res = await fetch("/api/preferences/review-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: `review:${Date.now()}` }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage(res.status === 409 ? "Review already requested." : "Request failed.");
      return;
    }
    setActionMessage("Review request submitted.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Relationship Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Manage your safe relationship preferences. Changes are reviewed by your adviser.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}
      {actionMessage && (
        <div role="status" className="rounded-md border bg-muted p-3 text-sm">
          {actionMessage}
        </div>
      )}

      {preferences && (
        <>
          <section aria-labelledby="dates-heading" className="space-y-3">
            <h2 id="dates-heading" className="text-lg font-medium">
              Important Dates
            </h2>
            {preferences.importantDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed important dates.</p>
            ) : (
              <ul className="space-y-2">
                {preferences.importantDates.map((d) => (
                  <li key={`${d.label}-${d.date}`} className="rounded-md border p-3">
                    <div className="font-medium">{d.label}</div>
                    <div className="text-sm">{d.date}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="optout-heading" className="space-y-3">
            <h2 id="optout-heading" className="text-lg font-medium">
              Acknowledgement Preferences
            </h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={birthdayOptOut}
                onChange={(e) => setBirthdayOptOut(e.target.checked)}
              />
              Opt out of birthday acknowledgements
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={festiveOptOut}
                onChange={(e) => setFestiveOptOut(e.target.checked)}
              />
              Opt out of festive acknowledgements
            </label>
            <button
              type="button"
              onClick={handleSaveOptOuts}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Save preferences
            </button>
          </section>

          <section aria-labelledby="review-heading" className="space-y-3">
            <h2 id="review-heading" className="text-lg font-medium">
              Request Review
            </h2>
            <button
              type="button"
              onClick={handleRequestReview}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Request a review with my adviser
            </button>
          </section>
        </>
      )}
    </div>
  );
}
