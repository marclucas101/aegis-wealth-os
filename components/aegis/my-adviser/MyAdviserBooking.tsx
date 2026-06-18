"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicAppointment } from "@/lib/aegis/calendar";

type AvailabilityResponse =
  | { ok: true; slots: Array<{ startsAt: string; endsAt: string; timezone: string }>; timezone: string }
  | { ok: false; reason?: string; error?: string };

type BookResponse =
  | { ok: true; appointment: PublicAppointment }
  | { ok: false; reason?: string; error?: string };

type AppointmentsResponse =
  | { ok: true; appointments: PublicAppointment[] }
  | { ok: false; reason?: string; error?: string };

function formatSlotLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function formatAppointment(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));
}

export default function MyAdviserBooking({
  bookingEnabled,
  calendarConnected,
}: {
  bookingEnabled: boolean;
  calendarConnected: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<
    Array<{ startsAt: string; endsAt: string; timezone: string }>
  >([]);
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [clientNotes, setClientNotes] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PublicAppointment | null>(null);
  const [upcoming, setUpcoming] = useState<PublicAppointment[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (!bookingEnabled || !calendarConnected) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/my-adviser/appointments", {
          cache: "no-store",
        });
        const payload = (await response.json()) as AppointmentsResponse;
        if (!cancelled && response.ok && payload.ok) {
          setUpcoming(payload.appointments);
        }
      } catch {
        // Non-blocking for booking section.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingEnabled, calendarConnected]);

  useEffect(() => {
    if (!selectedDate || !bookingEnabled) {
      return;
    }

    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setError(null);
      setSelectedSlot(null);

      try {
        const response = await fetch(
          `/api/my-adviser/availability?date=${encodeURIComponent(selectedDate)}&appointmentType=review`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as AvailabilityResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setSlots([]);
          setError(
            payload.ok
              ? "Unable to load availability"
              : payload.error ?? "Unable to load availability",
          );
          return;
        }

        setSlots(payload.slots);
        setTimezone(payload.timezone);
      } catch {
        if (!cancelled) {
          setError("Unable to load availability");
        }
      } finally {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, bookingEnabled]);

  async function refreshUpcoming() {
    try {
      const response = await fetch("/api/my-adviser/appointments", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AppointmentsResponse;
      if (response.ok && payload.ok) {
        setUpcoming(payload.appointments);
      }
    } catch {
      // Non-blocking for booking section.
    }
  }

  async function handleBook() {
    const slot = slots.find((item) => item.startsAt === selectedSlot);
    if (!slot) return;

    setBooking(true);
    setError(null);

    try {
      const response = await fetch("/api/my-adviser/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentType: "review",
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          clientNotes,
          idempotencyKey,
        }),
      });

      const payload = (await response.json()) as BookResponse;

      if (!response.ok || !payload.ok) {
        setError(
          payload.ok
            ? "Booking failed"
            : payload.error ??
                (payload.reason === "conflict"
                  ? "That slot is no longer available. Please choose another time."
                  : "Booking failed"),
        );
        return;
      }

      setSuccess(payload.appointment);
      setSelectedSlot(null);
      setClientNotes("");
      await refreshUpcoming();
    } catch {
      setError("Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(appointmentId: string) {
    setCancellingId(appointmentId);
    setError(null);

    try {
      const response = await fetch(
        `/api/my-adviser/book?appointmentId=${encodeURIComponent(appointmentId)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to cancel appointment");
        return;
      }

      await refreshUpcoming();
    } catch {
      setError("Failed to cancel appointment");
    } finally {
      setCancellingId(null);
    }
  }

  if (!bookingEnabled || !calendarConnected) {
    return (
      <div className="rounded-sm border border-dashed border-[#D1A866]/20 bg-[#071B2A]/35 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/60">
          Book My Adviser
        </p>
        <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
          Online appointment booking will be available once your adviser enables
          calendar scheduling.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
          Book My Adviser
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Select an available slot. You will receive a Google Calendar invitation.
        </p>

        {error && (
          <p className="mt-4 text-sm text-red-300/80">{error}</p>
        )}

        {success && (
          <div className="mt-4 rounded-sm border border-[#D1A866]/25 bg-[#071B2A]/40 px-4 py-3 text-sm text-[#D1A866]/90">
            Appointment confirmed for{" "}
            {formatAppointment(success.startsAt, success.timezone)}.
            {success.googleEventUrl && (
              <>
                {" "}
                <a
                  href={success.googleEventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View calendar event
                </a>
              </>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Appointment type
            </label>
            <p className="mt-1 text-sm text-[#F3F1EA]/75">60-minute review</p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDate(value);
                if (!value) {
                  setSlots([]);
                  setSelectedSlot(null);
                }
              }}
              className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
            />
          </div>
        </div>

        {selectedDate && (
          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
              Available times ({timezone})
            </p>
            {loadingSlots ? (
              <div className="mt-3 h-10 animate-pulse rounded-sm bg-[#071B2A]/50" />
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-[#F3F1EA]/45">
                No available slots on this date.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setSelectedSlot(slot.startsAt)}
                    className={`rounded-sm border px-3 py-2 text-sm ${
                      selectedSlot === slot.startsAt
                        ? "border-[#D1A866]/50 bg-[#D1A866]/15 text-[#F3F1EA]"
                        : "border-[#D1A866]/20 text-[#F3F1EA]/70 hover:border-[#D1A866]/35"
                    }`}
                  >
                    {formatSlotLabel(slot.startsAt, slot.timezone)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedSlot && (
          <>
            <div className="mt-5">
              <label className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                Optional note for your adviser
              </label>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
              />
            </div>

            <button
              type="button"
              disabled={booking}
              onClick={() => void handleBook()}
              className="mt-5 rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2 text-sm text-[#F3F1EA] hover:bg-[#D1A866]/20 disabled:opacity-50"
            >
              {booking ? "Booking…" : "Confirm booking"}
            </button>
          </>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
            Upcoming appointments
          </p>
          <div className="mt-4 space-y-3">
            {upcoming.map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-col gap-2 border-b border-[#D1A866]/10 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-[#F3F1EA]/80">
                      {appointment.appointmentLabel}
                    </p>
                    {appointment.scheduledByAdviser ? (
                      <span className="rounded-sm border border-[#D1A866]/25 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/80">
                        Scheduled by your adviser
                      </span>
                    ) : null}
                  </div>
                  {appointment.scheduledByAdviser && appointment.adviserName ? (
                    <p className="mt-1 text-xs text-[#F3F1EA]/40">
                      {appointment.adviserName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-[#F3F1EA]/50">
                    {formatAppointment(appointment.startsAt, appointment.timezone)}
                  </p>
                  {appointment.meetingUrl ? (
                    <a
                      href={appointment.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-[#D1A866] hover:underline"
                    >
                      Join meeting
                    </a>
                  ) : null}
                  {appointment.clientNotes ? (
                    <p className="mt-2 text-sm text-[#F3F1EA]/55">
                      {appointment.clientNotes}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {appointment.googleEventUrl && (
                    <a
                      href={appointment.googleEventUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#D1A866] hover:underline"
                    >
                      Calendar
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={cancellingId === appointment.id}
                    onClick={() => void handleCancel(appointment.id)}
                    className="text-xs text-[#F3F1EA]/50 hover:text-[#F3F1EA]/75 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
