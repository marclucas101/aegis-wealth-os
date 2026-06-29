"use client";

import { useEffect, useState } from "react";

import type { ClientAppointmentDetailDto } from "@/lib/crm-v2/client-appointments/types";

type Props = {
  appointmentId: string;
};

export default function ClientAppointmentDetail({ appointmentId }: Props) {
  const [detail, setDetail] = useState<ClientAppointmentDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/appointments/${appointmentId}`, { cache: "no-store" });
      const payload = (await response.json()) as
        | { ok: true; appointment: ClientAppointmentDetailDto }
        | { ok: false; reason?: string; error?: string };
      if (cancelled) return;
      if (!response.ok || !payload.ok) {
        setError(
          payload.ok
            ? "Failed to load details"
            : payload.error ?? payload.reason ?? "Failed to load details",
        );
        setDetail(null);
        setLoading(false);
        return;
      }
      setDetail(payload.appointment);
      setError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, reloadToken]);

  async function transition(action: "confirm" | "decline" | "cancel" | "reschedule") {
    if (!detail) return;
    setBusyAction(action);
    const route =
      action === "confirm"
        ? "confirm"
        : action === "decline"
          ? "decline"
          : action === "cancel"
            ? "cancel"
            : "reschedule-request";
    const response = await fetch(`/api/appointments/${appointmentId}/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: detail.version }),
    });
    if (response.status === 409) {
      setError("Appointment changed recently. Reload to continue.");
      setBusyAction(null);
      return;
    }
    const payload = (await response.json()) as { ok: boolean; error?: string; reason?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? payload.reason ?? "Action failed");
      setBusyAction(null);
      return;
    }
    setReloadToken((value) => value + 1);
    setBusyAction(null);
  }

  async function saveTopics(nextTopics: string[]) {
    const response = await fetch(`/api/appointments/${appointmentId}/topics`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: nextTopics }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string; reason?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? payload.reason ?? "Unable to save topics");
      return;
    }
    setReloadToken((value) => value + 1);
  }

  async function updateChecklist(itemId: string, completed: boolean) {
    const response = await fetch(`/api/appointments/${appointmentId}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string; reason?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? payload.reason ?? "Unable to update checklist");
      return;
    }
    setReloadToken((value) => value + 1);
  }

  if (loading) return <p className="text-sm text-[#F3F1EA]/70">Loading appointment...</p>;
  if (error && !detail) return <p className="text-sm text-[#F3F1EA]/70">{error}</p>;
  if (!detail) return <p className="text-sm text-[#F3F1EA]/70">Appointment not found.</p>;

  return (
    <section aria-labelledby="appointment-detail-heading" className="space-y-4">
      <header>
        <h2 id="appointment-detail-heading" className="text-xl text-[#F3F1EA]">
          {detail.title || detail.templateLabel}
        </h2>
        <p className="text-sm text-[#F3F1EA]/70">{detail.lifecycleLabel}</p>
        <p className="text-sm text-[#F3F1EA]/70">
          {new Date(detail.startsAt).toLocaleString()} ({detail.timezone})
        </p>
      </header>

      {error && <p className="text-sm text-[#F3F1EA]/75">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {detail.allowedActions.includes("confirm_proposal") && (
          <button
            type="button"
            className="rounded border border-[#D1A866]/35 px-3 py-2 text-sm"
            disabled={busyAction === "confirm"}
            onClick={() => void transition("confirm")}
          >
            Confirm
          </button>
        )}
        {detail.allowedActions.includes("decline_proposal") && (
          <button
            type="button"
            className="rounded border border-[#D1A866]/35 px-3 py-2 text-sm"
            disabled={busyAction === "decline"}
            onClick={() => void transition("decline")}
          >
            Decline
          </button>
        )}
        {detail.allowedActions.includes("request_reschedule") && (
          <button
            type="button"
            className="rounded border border-[#D1A866]/35 px-3 py-2 text-sm"
            disabled={busyAction === "reschedule"}
            onClick={() => void transition("reschedule")}
          >
            Request reschedule
          </button>
        )}
        {detail.allowedActions.includes("cancel_appointment") && (
          <button
            type="button"
            className="rounded border border-[#D1A866]/35 px-3 py-2 text-sm"
            disabled={busyAction === "cancel"}
            onClick={() => void transition("cancel")}
          >
            Cancel appointment
          </button>
        )}
      </div>

      <section>
        <h3 className="text-base text-[#F3F1EA]">Discussion topics</h3>
        <ul className="mt-2 space-y-1 text-sm text-[#F3F1EA]/75">
          {detail.clientTopics.map((topic) => (
            <li key={topic.topicId}>- {topic.topic}</li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-2 rounded border border-[#D1A866]/35 px-3 py-1 text-sm"
          onClick={() => {
            const value = window.prompt("Enter topics separated by comma", detail.clientTopics.map((t) => t.topic).join(", "));
            if (typeof value !== "string") return;
            const topics = value.split(",").map((v) => v.trim()).filter(Boolean);
            void saveTopics(topics);
          }}
        >
          Edit topics
        </button>
      </section>

      <section>
        <h3 className="text-base text-[#F3F1EA]">Preparation checklist</h3>
        <ul className="mt-2 space-y-2">
          {detail.checklistItems.map((item) => (
            <li key={item.itemId} className="flex items-center gap-2 text-sm">
              <input
                id={item.itemId}
                type="checkbox"
                checked={item.completed}
                onChange={(e) => void updateChecklist(item.itemId, e.target.checked)}
              />
              <label htmlFor={item.itemId} className="text-[#F3F1EA]/80">
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
