"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  ClientAppointmentListView,
  ClientAppointmentSummaryDto,
} from "@/lib/crm-v2/client-appointments/types";

const VIEWS: Array<{ id: ClientAppointmentListView; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "awaiting_response", label: "Awaiting response" },
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
          setError(payload.ok ? "Failed to load appointments" : payload.error ?? payload.reason ?? "Failed to load appointments");
          setRows([]);
          return;
        }
        setRows(payload.appointments);
      } catch {
        if (!cancelled) setError("Failed to load appointments");
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
    if (view === "awaiting_response") return "No appointments are awaiting your response.";
    if (view === "preparation") return "No preparation items are outstanding.";
    if (view === "follow_up") return "No follow-up items are currently published.";
    if (view === "history") return "No appointment history yet.";
    return "No upcoming appointments yet.";
  }, [view]);

  return (
    <section aria-labelledby="appointments-dashboard-heading" className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Appointment views">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            className={`rounded border px-3 py-2 text-sm ${
              view === item.id ? "border-[#D1A866] text-[#F3F1EA]" : "border-[#D1A866]/20 text-[#F3F1EA]/65"
            }`}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#F3F1EA]/65">Loading appointments...</p>
      ) : error ? (
        <p className="text-sm text-[#F3F1EA]/75">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#F3F1EA]/65">{emptyMessage}</p>
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
                Open details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
