"use client";

import Link from "next/link";
import { useState } from "react";

import { buildRelationshipDetailHref } from "@/lib/crm-v2/relationships/routes";
import type {
  AdviserAdvocacyWorkspaceDto,
  CrmAdvocacyEventType,
  CrmAdvocacyWorkspaceView,
} from "@/lib/crm-v2/advocacy/types";
import { advocacyEventTypeLabel } from "@/lib/crm-v2/advocacy/types";

const VIEWS: Array<{ id: CrmAdvocacyWorkspaceView; label: string }> = [
  { id: "history", label: "Advocacy History" },
  { id: "introductions", label: "Introductions" },
  { id: "referrals", label: "Referrals" },
  { id: "testimonials", label: "Testimonials & Consent" },
  { id: "follow_up", label: "Follow-up Needed" },
  { id: "consent", label: "Consent Status" },
  { id: "summary", label: "Yearly Summary" },
];

const EVENT_TYPES: CrmAdvocacyEventType[] = [
  "introduction_offered",
  "introduction_made",
  "referral_received",
  "referral_contacted",
  "referral_declined",
  "testimonial_offered",
  "testimonial_consented",
  "testimonial_withdrawn",
  "review_requested",
  "review_completed",
  "client_feedback_received",
  "permission_to_mention_granted",
  "permission_withdrawn",
  "thank_you_sent",
  "do_not_ask_recorded",
];

type Props = {
  relationshipId: string;
  initialView: CrmAdvocacyWorkspaceView;
  initialWorkspace: AdviserAdvocacyWorkspaceDto | null;
  loadError: string | null;
};

export function RelationshipAdvocacyClient({
  relationshipId,
  initialView,
  initialWorkspace,
  loadError,
}: Props) {
  const [view, setView] = useState<CrmAdvocacyWorkspaceView>(initialView);
  const [workspace, setWorkspace] = useState<AdviserAdvocacyWorkspaceDto | null>(initialWorkspace);
  const [error, setError] = useState<string | null>(loadError);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newEventType, setNewEventType] = useState<CrmAdvocacyEventType>("introduction_offered");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");

  async function refreshWorkspace() {
    setError(null);
    try {
      const res = await fetch(`/api/advisor-v2/relationships/${relationshipId}/advocacy`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.reason === "feature_disabled"
            ? "Advocacy is not enabled."
            : "Unable to load advocacy workspace.",
        );
        return;
      }
      setWorkspace(data.workspace);
    } catch {
      setError("Unable to load advocacy workspace.");
    }
  }

  async function handleCreateEvent() {
    if (!newTitle.trim()) return;
    setActionMessage(null);
    const res = await fetch(`/api/advisor-v2/relationships/${relationshipId}/advocacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: newEventType,
        safeTitle: newTitle.trim(),
        eventDate: newDate || undefined,
        visibility: "adviser_only",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage(data.error ?? "Failed to record advocacy event.");
      return;
    }
    setNewTitle("");
    setNewDate("");
    setActionMessage("Advocacy event recorded.");
    await refreshWorkspace();
  }

  async function handleTransition(eventId: string, version: number, transition: string) {
    setActionMessage(null);
    const res = await fetch(
      `/api/advisor-v2/relationships/${relationshipId}/advocacy/${eventId}/transition`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, transition }),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setActionMessage(res.status === 409 ? "Stale version — reload and try again." : "Transition failed.");
      return;
    }
    setActionMessage("Advocacy event updated.");
    await refreshWorkspace();
  }

  const events =
    view === "introductions"
      ? workspace?.introductions ?? []
      : view === "referrals"
        ? workspace?.referrals ?? []
        : view === "testimonials"
          ? workspace?.testimonials ?? []
          : view === "follow_up"
            ? workspace?.followUpNeeded ?? []
            : workspace?.history ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Link
          href={buildRelationshipDetailHref(relationshipId)}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to Relationship 360
        </Link>
        <h1 className="text-2xl font-semibold">Advocacy</h1>
        <p className="text-sm text-muted-foreground">
          Consent-aware advocacy history — not used for sales ranking or queue priority.
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

      <nav aria-label="Advocacy views" className="flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            aria-current={view === item.id ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${
              view === item.id ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {view === "summary" && workspace?.summary && (
        <section aria-labelledby="advocacy-summary-heading" className="rounded-lg border p-4 space-y-2">
          <h2 id="advocacy-summary-heading" className="font-medium">
            Yearly event summary ({workspace.summary.calendarYear})
          </h2>
          <p>Events recorded: {workspace.summary.eventCount}</p>
          <p>
            Yearly score:{" "}
            {workspace.summary.yearlyScore != null ? workspace.summary.yearlyScore : "Insufficient data"}
          </p>
          {workspace.summary.scoreExplanation && (
            <p className="text-sm text-muted-foreground">{workspace.summary.scoreExplanation}</p>
          )}
          <p>Consent: {workspace.summary.consentStatus.replace(/_/g, " ")}</p>
          {workspace.summary.doNotAsk && <p className="text-sm font-medium">Do-not-ask preference active</p>}
        </section>
      )}

      {view === "consent" && workspace?.summary && (
        <section aria-labelledby="consent-status-heading" className="rounded-lg border p-4 space-y-2">
          <h2 id="consent-status-heading" className="font-medium">
            Consent status
          </h2>
          <p>Testimonial consent: {workspace.summary.consentStatus.replace(/_/g, " ")}</p>
          <p>Permission to mention: {workspace.summary.permissionToMention ? "Granted" : "Not granted"}</p>
          <p>Referral ask opt-out: {workspace.summary.referralAskOptOut ? "Yes" : "No"}</p>
          <p>Do-not-ask: {workspace.summary.doNotAsk ? "Yes" : "No"}</p>
        </section>
      )}

      {!error && view !== "summary" && view !== "consent" && (
        <>
          <section aria-labelledby="record-event-heading" className="rounded-lg border p-4 space-y-3">
            <h2 id="record-event-heading" className="font-medium">
              Record advocacy event
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                Event type
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as CrmAdvocacyEventType)}
                  className="w-full rounded border px-2 py-1"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {advocacyEventTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Safe title
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded border px-2 py-1"
                  maxLength={200}
                />
              </label>
              <label className="space-y-1 text-sm">
                Event date
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded border px-2 py-1"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleCreateEvent}
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Record event
            </button>
          </section>

          <section aria-labelledby="advocacy-events-heading" className="space-y-3">
            <h2 id="advocacy-events-heading" className="font-medium">
              {VIEWS.find((v) => v.id === view)?.label ?? "Events"}
            </h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No advocacy events in this view.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <li key={event.eventId} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{event.safeTitle}</p>
                        <p className="text-sm text-muted-foreground">
                          {advocacyEventTypeLabel(event.eventType)} · {event.eventDate}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Consent: {event.consentState.replace(/_/g, " ")} · Follow-up:{" "}
                          {event.followUpStatus.replace(/_/g, " ")}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {event.labels.map((label) => (
                            <span key={label} className="rounded bg-muted px-2 py-0.5 text-xs">
                              {label.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {event.consentState === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(event.eventId, event.version, "consent_granted")}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            Grant consent
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTransition(event.eventId, event.version, "thank_you_sent")}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          Thank-you sent
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTransition(event.eventId, event.version, "deactivate")}
                          className="rounded border px-2 py-1 text-xs text-destructive"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {workspace?.bounded && (
              <p className="text-xs text-muted-foreground">List bounded — not all events shown.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
