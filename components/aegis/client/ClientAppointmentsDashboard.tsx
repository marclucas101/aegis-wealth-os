"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { clientAppointmentActionErrorMessage } from "@/lib/crm-v2/client-appointments/labels";
import type {
  ClientAppointmentListView,
  ClientAppointmentSummaryDto,
} from "@/lib/crm-v2/client-appointments/types";

const VIEWS: Array<{ id: ClientAppointmentListView; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "awaiting_response", label: "Awaiting your response" },
  { id: "preparation", label: "Preparation" },
  { id: "follow_up", label: "Follow-up" },
  { id: "history", label: "History" },
];

export default function ClientAppointmentsDashboard() {
  const [view, setView] = useState<ClientAppointmentListView>("upcoming");
  const [rows, setRows] = useState<ClientAppointmentSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/appointments?view=${view}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as
          | { ok: true; appointments: ClientAppointmentSummaryDto[] }
          | { ok: false; reason?: string; error?: string };
        if (cancelled) return;
        if (!response.ok || !payload.ok) {
          setError(
            payload.ok
              ? "Unable to load appointments right now."
              : clientAppointmentActionErrorMessage(
                  payload.reason,
                  payload.error ?? "Unable to load appointments right now.",
                ),
          );
          setRows([]);
          return;
        }
        setRows(payload.appointments);
      } catch {
        if (!cancelled) setError("Unable to load appointments right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [view]);

  const emptyMessage = useMemo(() => {
    if (view === "awaiting_response") {
      return "Nothing needs your response right now.";
    }
    if (view === "preparation") return "No preparation items are outstanding.";
    if (view === "follow_up") return "No follow-up items are currently available.";
    if (view === "history") return "No appointment history yet.";
    return "No upcoming appointments yet.";
  }, [view]);

  return (
    <section aria-labelledby="appointments-dashboard-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="appointments-dashboard-heading" className="sr-only">
          Your appointments
        </h2>
        <Link
          href="/appointments/request"
          className="rounded bg-[#D1A866] px-4 py-2 text-sm text-[#10283A]"
        >
          Request an appointment
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Appointment views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            className={`rounded border px-3 py-2 text-sm ${
              view === item.id
                ? "border-[#D1A866] text-[#F3F1EA]"
                : "border-[#D1A866]/20 text-[#F3F1EA]/65"
            }`}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#F3F1EA]/65">Loading appointments…</p>
      ) : error ? (
        <p className="text-sm text-[#F3F1EA]/75">{error}</p>
      ) : rows.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-[#F3F1EA]/65">{emptyMessage}</p>
          <Link href="/appointments/request" className="inline-block text-sm text-[#D1A866] underline">
            Request an appointment
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.appointmentId} className="rounded border border-[#D1A866]/20 p-4">
              <h3 className="text-base text-[#F3F1EA]">{row.title || row.templateLabel}</h3>
              <p className="text-sm text-[#F3F1EA]/70">
                {new Date(row.startsAt).toLocaleString()} ({row.timezone})
              </p>
              <p className="text-sm text-[#F3F1EA]/70">{row.lifecycleLabel}</p>
              <Link
                href={`/appointments/${row.appointmentId}`}
                className="mt-2 inline-block text-sm text-[#D1A866] underline"
              >
                View details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
