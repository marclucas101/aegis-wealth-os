"use client";

import Link from "next/link";
import { useState } from "react";

import type { ClientAdvocacyPreferencesDto } from "@/lib/crm-v2/advocacy/types";

type Props = {
  initialPreferences: ClientAdvocacyPreferencesDto | null;
  loadError: string | null;
};

export function ClientAdvocacyPreferencesClient({ initialPreferences, loadError }: Props) {
  const [preferences, setPreferences] = useState<ClientAdvocacyPreferencesDto | null>(initialPreferences);
  const [error, setError] = useState<string | null>(loadError);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshPreferences() {
    setError(null);
    try {
      const res = await fetch("/api/preferences/advocacy", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError("Advocacy preferences are not available.");
        return;
      }
      setPreferences(data.preferences);
    } catch {
      setError("Unable to load advocacy preferences.");
    }
  }

  async function handleSave(update: Partial<ClientAdvocacyPreferencesDto>) {
    if (!preferences) return;
    setMessage(null);
    const res = await fetch("/api/preferences/advocacy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: preferences.version,
        testimonialConsent: update.testimonialConsent,
        referralAskOptOut: update.referralAskOptOut,
        permissionToMention: update.permissionToMention,
        doNotAsk: update.doNotAsk,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage(res.status === 409 ? "Preferences changed elsewhere — reload and try again." : "Save failed.");
      return;
    }
    setPreferences(data.preferences);
    setMessage("Preferences saved.");
  }

  async function handleWithdraw() {
    if (!preferences) return;
    setMessage(null);
    const res = await fetch("/api/preferences/advocacy/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: preferences.version }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setMessage(res.status === 409 ? "Already withdrawn or stale version." : "Withdrawal failed.");
      return;
    }
    setPreferences(data.preferences);
    setMessage("Permission withdrawn.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Link href="/preferences" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Back to preferences
        </Link>
        <h1 className="text-2xl font-semibold">Advocacy preferences</h1>
        <p className="text-sm text-muted-foreground">
          Manage testimonial permission and referral preferences. No advocacy score is shown here.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="rounded-md border bg-muted p-3 text-sm">
          {message}
        </div>
      )}

      {preferences && (
        <section aria-labelledby="advocacy-prefs-heading" className="space-y-4 rounded-lg border p-4">
          <h2 id="advocacy-prefs-heading" className="font-medium">
            Your preferences
          </h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.permissionToMention}
              onChange={(e) => handleSave({ permissionToMention: e.target.checked })}
            />
            Permission to mention me (with adviser review)
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.referralAskOptOut}
              onChange={(e) => handleSave({ referralAskOptOut: e.target.checked })}
            />
            Opt out of referral asks
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.doNotAsk}
              onChange={(e) => handleSave({ doNotAsk: e.target.checked })}
            />
            Do not ask for introductions or testimonials
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSave({ testimonialConsent: "granted" })}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Grant testimonial permission
            </button>
            <button
              type="button"
              onClick={handleWithdraw}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Withdraw permission
            </button>
            <button type="button" onClick={refreshPreferences} className="rounded border px-3 py-1.5 text-sm">
              Refresh
            </button>
          </div>

          {preferences.safeAcknowledgementHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Acknowledgement history</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {preferences.safeAcknowledgementHistory.map((item, index) => (
                  <li key={`${item.occurredAt}-${index}`}>
                    {item.safeTitle} — {new Date(item.occurredAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
