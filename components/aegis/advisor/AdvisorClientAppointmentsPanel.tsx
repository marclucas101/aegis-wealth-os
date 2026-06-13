"use client";

import { useEffect, useState } from "react";

import type { PublicAppointment } from "@/lib/aegis/calendar";

type AppointmentsResponse =
  | { ok: true; appointments: PublicAppointment[] }
  | { ok: false; error?: string };

function formatDateTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));
}

export default function AdvisorClientAppointmentsPanel({
  clientId,
}: {
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<PublicAppointment[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/appointments`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as AppointmentsResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setError(
            payload.ok
              ? "Failed to load appointments"
              : payload.error ?? "Failed to load appointments",
          );
          return;
        }

        setAppointments(payload.appointments);
      } catch {
        if (!cancelled) {
          setError("Failed to load appointments");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
        {error}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No upcoming appointments scheduled for this client.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => (
        <article
          key={appointment.id}
          className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-5"
        >
          <p className="text-[10px] uppercase tracking-wider text-[#D1A866]/60">
            {appointment.status}
          </p>
          <h3 className="mt-1 text-lg font-light text-[#F3F1EA]">
            {appointment.appointmentLabel}
          </h3>
          <p className="mt-1 text-sm text-[#F3F1EA]/55">
            {formatDateTime(appointment.startsAt, appointment.timezone)}
          </p>
          {appointment.googleEventUrl && (
            <a
              href={appointment.googleEventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-[#D1A866] hover:underline"
            >
              Open in Google Calendar
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
