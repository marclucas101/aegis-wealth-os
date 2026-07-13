"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { clientAppointmentActionErrorMessage } from "@/lib/crm-v2/client-appointments/labels";

const APPOINTMENT_TYPES = [
  { value: "review", label: "Review meeting" },
  { value: "planning", label: "Planning discussion" },
  { value: "check_in", label: "Check-in" },
  { value: "general", label: "General discussion" },
] as const;

export default function ClientAppointmentRequestForm() {
  const [title, setTitle] = useState("");
  const [appointmentType, setAppointmentType] = useState("review");
  const [preferredStartsAt, setPreferredStartsAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [deliveryMode, setDeliveryMode] = useState("google_meet");
  const [topics, setTopics] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const start = new Date(preferredStartsAt);
    if (Number.isNaN(start.getTime())) {
      setError("Please choose a valid date and time.");
      setSubmitting(false);
      return;
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `client_req_${crypto.randomUUID()}`;
    }

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
        idempotencyKey: idempotencyKeyRef.current,
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
      setError(
        payload.ok
          ? "Unable to submit your request. Please try again."
          : clientAppointmentActionErrorMessage(
              payload.reason,
              payload.error ?? "Unable to submit your request. Please try again.",
            ),
      );
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <section className="space-y-4" aria-labelledby="appointment-request-confirmation">
        <h2 id="appointment-request-confirmation" className="text-lg text-[#F3F1EA]">
          Request received
        </h2>
        <p className="text-sm text-[#F3F1EA]/80">
          Your adviser will review the request and follow up. This is not a confirmed appointment
          until your adviser confirms a time with you.
        </p>
        <Link href="/appointments" className="inline-block text-sm text-[#D1A866] underline">
          View your appointments
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="appointment-request-heading">
      <div className="space-y-2">
        <h2 id="appointment-request-heading" className="text-lg text-[#F3F1EA]">
          Request an appointment
        </h2>
        <p className="text-sm text-[#F3F1EA]/75">
          Share your preferred timing and what you would like to discuss. Your adviser will review
          the request and follow up.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" aria-label="Request appointment form">
        <label className="block text-sm">
          <span className="mb-1 block text-[#F3F1EA]/80">What would you like to discuss?</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual review, insurance questions"
            className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#F3F1EA]/80">Meeting type</span>
          <select
            value={appointmentType}
            onChange={(e) => setAppointmentType(e.target.value)}
            className="w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
            required
          >
            {APPOINTMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
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
          <span className="mb-1 block text-[#F3F1EA]/80">How would you prefer to meet?</span>
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
          <span className="mb-1 block text-[#F3F1EA]/80">Topics (optional, one per line)</span>
          <textarea
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Anything specific you want to cover"
            className="min-h-28 w-full rounded border border-[#D1A866]/25 bg-transparent px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[#D1A866] px-4 py-2 text-[#10283A] disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
        {error ? <p className="text-sm text-[#F3F1EA]/75">{error}</p> : null}
      </form>
    </section>
  );
}
