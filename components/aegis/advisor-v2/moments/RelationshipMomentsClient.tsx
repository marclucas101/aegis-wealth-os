"use client";

import { buildRelationshipDetailHref } from "@/lib/crm-v2/relationships/routes";

import Link from "next/link";
import { useState } from "react";

import type {
  AdviserMomentsWorkspaceDto,
  CrmMomentsWorkspaceView,
} from "@/lib/crm-v2/moments/types";

const VIEWS: Array<{ id: CrmMomentsWorkspaceView; label: string }> = [
  { id: "upcoming", label: "Upcoming Moments" },
  { id: "important_dates", label: "Important Dates" },
  { id: "review_rhythm", label: "Review Rhythm" },
  { id: "client_preferences", label: "Client Preferences" },
  { id: "festive_suggestions", label: "Festive Suggestions" },
  { id: "past_acknowledgements", label: "Past Acknowledgements" },
  { id: "data_quality", label: "Data Quality" },
];

type Props = {
  relationshipId: string;
  initialView: CrmMomentsWorkspaceView;
  initialWorkspace: AdviserMomentsWorkspaceDto | null;
  loadError: string | null;
};

export function RelationshipMomentsClient({
  relationshipId,
  initialView,
  initialWorkspace,
  loadError,
}: Props) {
  const [view, setView] = useState<CrmMomentsWorkspaceView>(initialView);
  const [workspace, setWorkspace] = useState<AdviserMomentsWorkspaceDto | null>(initialWorkspace);
  const [error, setError] = useState<string | null>(loadError);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  async function refreshWorkspace() {
    setError(null);
    try {
      const res = await fetch(`/api/advisor-v2/relationships/${relationshipId}/moments`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.reason === "feature_disabled"
            ? "Relationship moments are not enabled."
            : "Unable to load moments workspace.",
        );
        return;
      }
      setWorkspace(data.workspace);
    } catch {
      setError("Unable to load moments workspace.");
    }
  }

  async function handleCreateMoment() {
    if (!newTitle.trim()) return;
    setActionMessage(null);
    const res = await fetch(`/api/advisor-v2/relationships/${relationshipId}/moments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        momentType: "custom_adviser_reminder",
        title: newTitle.trim(),
        momentDate: newDate || null,
        visibility: "adviser_only",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage("Failed to create moment.");
      return;
    }
    setNewTitle("");
    setNewDate("");
    setActionMessage("Moment created.");
    await refreshWorkspace();
  }

  async function handleAcknowledge(momentId: string) {
    setActionMessage(null);
    const res = await fetch(
      `/api/advisor-v2/relationships/${relationshipId}/moments/${momentId}/acknowledge`,
      { method: "POST" },
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage(res.status === 409 ? "Already acknowledged." : "Acknowledgement failed.");
      return;
    }
    setActionMessage("Moment acknowledged.");
    await refreshWorkspace();
  }

  async function handleDeactivate(momentId: string, version: number) {
    setActionMessage(null);
    const res = await fetch(
      `/api/advisor-v2/relationships/${relationshipId}/moments/${momentId}/deactivate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version }),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage(res.status === 409 ? "Stale version — reload and try again." : "Deactivation failed.");
      return;
    }
    setActionMessage("Moment deactivated.");
    await refreshWorkspace();
  }

  const moments =
    view === "important_dates"
      ? workspace?.importantDates ?? []
      : view === "past_acknowledgements"
        ? workspace?.pastAcknowledgements ?? []
        : workspace?.upcomingMoments ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Link
          href={buildRelationshipDetailHref(relationshipId)}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Relationship 360
        </Link>
        <h1 className="text-2xl font-semibold">Relationship Moments</h1>
        <p className="text-sm text-muted-foreground">
          Adviser-confirmed relationship moments and review rhythm. No automatic outreach.
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

      <nav aria-label="Moments workspace views" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-current={view === v.id ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === v.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === "festive_suggestions" && (
        <section aria-labelledby="festive-heading" className="space-y-3">
          <h2 id="festive-heading" className="text-lg font-medium">
            Festive Suggestions
          </h2>
          <p className="text-sm text-muted-foreground">
            Optional suggestions only — adviser must confirm. Never sent automatically.
          </p>
          {(workspace?.festiveSuggestions ?? []).length === 0 ? (
            <p className="text-sm">No festive suggestions available.</p>
          ) : (
            <ul className="space-y-2">
              {workspace?.festiveSuggestions.map((s) => (
                <li key={s.holidayKey} className="rounded-md border p-3">
                  <div className="font-medium">{s.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    Suggested · {s.labels.join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view === "review_rhythm" && (
        <section aria-labelledby="review-heading" className="space-y-3">
          <h2 id="review-heading" className="text-lg font-medium">
            Review Rhythm
          </h2>
          {(workspace?.reviewRhythm ?? []).length === 0 ? (
            <p className="text-sm">No review rhythm configured.</p>
          ) : (
            <ul className="space-y-2">
              {workspace?.reviewRhythm.map((r) => (
                <li key={r.reviewRhythmId} className="rounded-md border p-3">
                  <div className="font-medium">{r.reviewType.replace(/_/g, " ")}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.status} · Next due: {r.nextDueDate ?? "Not scheduled"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view === "client_preferences" && (
        <section aria-labelledby="prefs-heading" className="space-y-3">
          <h2 id="prefs-heading" className="text-lg font-medium">
            Client Preferences
          </h2>
          <ul className="space-y-2">
            {(workspace?.clientPreferences ?? []).map((p) => (
              <li key={p.preferenceType} className="rounded-md border p-3">
                <div className="font-medium">{p.label}</div>
                <div className="text-sm">{p.value}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "data_quality" && (
        <section aria-labelledby="quality-heading" className="space-y-3">
          <h2 id="quality-heading" className="text-lg font-medium">
            Data Quality Warnings
          </h2>
          {(workspace?.dataQualityWarnings ?? []).length === 0 ? (
            <p className="text-sm">No data quality warnings.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {workspace?.dataQualityWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {["upcoming", "important_dates", "past_acknowledgements"].includes(view) && (
        <section aria-labelledby="moments-heading" className="space-y-3">
          <h2 id="moments-heading" className="text-lg font-medium">
            {VIEWS.find((v) => v.id === view)?.label}
          </h2>
          {moments.length === 0 ? (
            <p className="text-sm">No moments in this view.</p>
          ) : (
            <ul className="space-y-2">
              {moments.map((m) => (
                <li key={m.momentId} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {m.momentType.replace(/_/g, " ")} · {m.labels.join(", ")}
                      </div>
                      {m.nextOccurrenceDate && (
                        <div className="text-sm">Next: {m.nextOccurrenceDate}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(m.momentId)}
                        className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                      >
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(m.momentId, m.version)}
                        className="rounded-md border px-2 py-1 text-xs"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="create-heading" className="space-y-3 rounded-md border p-4">
        <h2 id="create-heading" className="text-lg font-medium">
          Create Moment
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Moment title"
            aria-label="Moment title"
            className="flex-1 rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="Moment date"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreateMoment}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Create
          </button>
        </div>
      </section>
    </div>
  );
}
