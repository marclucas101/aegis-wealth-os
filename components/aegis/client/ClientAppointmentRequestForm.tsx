"use client";

import { useState } from "react";

export default function ClientAppointmentRequestForm() {
  const [title, setTitle] = useState("");
  const [appointmentType, setAppointmentType] = useState("review");
  const [preferredStartsAt, setPreferredStartsAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [deliveryMode, setDeliveryMode] = useState("google_meet");
  const [topics, setTopics] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(null);

    const start = new Date(preferredStartsAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const idempotencyKey = `client_req_${start.getTime()}_${appointmentType}_${title.slice(0, 24)}`;
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentType,
        title,
        preferredStartsAt: start.toISOString(),
        preferredEndsAt: end.toISOString(),
        timezone,
        deliveryMode,
        idempotencyKey,
        topics: topics
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    const payload = (await response.json()) as
      | { ok: true; appointmentId: string }
      | { ok: false; error?: string; reason?: string };
    if (!response.ok || !payload.ok) {
      setError(payload.ok ? "Unable to submit request" : payload.error ?? payload.reason ?? "Unable to submit request");
      setSubmitting(false);
      return;
    }
    setSaved(payload.appointmentId);
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Request appointment form">
      <label className="block text-sm">
        <span className="mb-1 block text-[#F3F1EA]/80">Purpose</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#F3F1EA]/80">Appointment type</span>
        <input
          value={appointmentType}
          onChange={(e) => setAppointmentType(e.target.value)}
          className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#F3F1EA]/80">Preferred date and time</span>
        <input
          type="datetime-local"
          value={preferredStartsAt}
          onChange={(e) => setPreferredStartsAt(e.target.value)}
          className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#F3F1EA]/80">Timezone</span>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#F3F1EA]/80">Delivery preference</span>
        <select
          value={deliveryMode}
          onChange={(e) => setDeliveryMode(e.target.value)}
          className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
        >
          <option value="google_meet">Video call</option>
          <option value="phone">Phone</option>
          <option value="physical">In person</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#F3F1EA]/80">Topics (one line per topic)</span>
        <textarea
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          className="min-h-28 w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-[#D1A866] px-4 py-2 text-[#10283A] disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Request appointment"}
      </button>
      {error && <p className="text-sm text-[#F3F1EA]/75">{error}</p>}
      {saved && <p className="text-sm text-[#F3F1EA]/75">Request submitted ({saved}).</p>}
    </form>
  );
}
