"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import CrmV2SectionPanel from "@/components/aegis/advisor-v2/CrmV2SectionPanel";
import { buildAppointmentListHref } from "@/lib/crm-v2/appointments/routes";
import type { CrmAppointmentDetail } from "@/lib/crm-v2/appointments/types";

const ACTION_TRANSITIONS: Record<string, { toStatus: string; reasonCode: string }> = {
  confirm: { toStatus: "confirmed", reasonCode: "adviser_confirmed" },
  begin_preparation: { toStatus: "preparing", reasonCode: "begin_preparation" },
  mark_ready: { toStatus: "ready", reasonCode: "preparation_complete" },
  start_meeting: { toStatus: "in_progress", reasonCode: "meeting_started" },
  move_to_follow_up: { toStatus: "follow_up_required", reasonCode: "follow_up_needed" },
  close: { toStatus: "closed", reasonCode: "follow_up_complete" },
  cancel: { toStatus: "cancelled_by_adviser", reasonCode: "adviser_cancelled" },
  record_no_show: { toStatus: "no_show", reasonCode: "no_show_recorded" },
};

interface AppointmentDetailClientProps {
  initialAppointment: CrmAppointmentDetail;
}

export default function AppointmentDetailClient({
  initialAppointment,
}: AppointmentDetailClientProps) {
  const router = useRouter();
  const [appointment, setAppointment] = useState(initialAppointment);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [googleSyncStatus, setGoogleSyncStatus] = useState<string | null>(null);

  async function reloadDetail() {
    const response = await fetch(`/api/advisor-v2/appointments/${appointment.appointmentId}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      ok: boolean;
      appointment?: CrmAppointmentDetail;
    };
    if (response.ok && payload.ok && payload.appointment) {
      setAppointment(payload.appointment);
    }
  }

  async function runTransition(action: string) {
    const mapping = ACTION_TRANSITIONS[action];
    if (!mapping) return;

    setLoadingAction(action);
    setError(null);
    setConflict(null);

    try {
      const response = await fetch(
        `/api/advisor-v2/appointments/${appointment.appointmentId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStatus: mapping.toStatus,
            reasonCode: mapping.reasonCode,
            version: appointment.version,
          }),
        },
      );

      const payload = (await response.json()) as { ok: boolean; error?: string; reason?: string };

      if (response.status === 409) {
        setConflict(payload.error ?? "This appointment was updated elsewhere.");
        return;
      }

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Action could not be completed");
        return;
      }

      await reloadDetail();
      router.refresh();
    } catch {
      setError("Action could not be completed");
    } finally {
      setLoadingAction(null);
    }
  }

  async function runGoogleSync(path: "sync" | "retry") {
    setLoadingAction(`google_${path}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor-v2/appointments/${appointment.appointmentId}/google-calendar/${path}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Google sync failed");
        return;
      }
      await reloadDetail();
      const statusResponse = await fetch(
        `/api/advisor-v2/appointments/${appointment.appointmentId}/google-calendar/status`,
        { cache: "no-store" },
      );
      const statusPayload = (await statusResponse.json()) as { ok: boolean; status?: string };
      if (statusPayload.ok && statusPayload.status) {
        setGoogleSyncStatus(statusPayload.status);
      }
    } catch {
      setError("Google sync failed");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <CrmV2PageHeader
        title={appointment.title ?? appointment.templateLabel}
        subtitle={`${appointment.clientDisplayName} · ${appointment.lifecycleLabel}`}
      />

      <div className="mb-4">
        <Link href={buildAppointmentListHref()} className="text-sm font-medium text-slate-700 underline">
          Back to appointments
        </Link>
      </div>

      {appointment.lifecycleStatus === "requested" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Client appointment request — review preferred timing and topics below. Confirm or propose
          another time when ready. No message or calendar invite is sent automatically.
        </p>
      ) : null}

      {appointment.sourceWarnings.length > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          Some appointment details are temporarily unavailable.
        </p>
      ) : null}

      {conflict ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          {conflict}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <CrmV2SectionPanel title="Summary">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-600">Relationship</dt>
            <dd>
              <Link href={appointment.relationshipHref} className="text-slate-900 underline">
                {appointment.clientDisplayName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Lifecycle</dt>
            <dd>{appointment.lifecycleLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Schedule</dt>
            <dd>
              {new Date(appointment.startsAt).toLocaleString(undefined, {
                timeZone: appointment.timezone,
              })}{" "}
              –{" "}
              {new Date(appointment.endsAt).toLocaleTimeString(undefined, {
                timeZone: appointment.timezone,
              })}{" "}
              ({appointment.timezone})
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-600">Delivery</dt>
            <dd>{appointment.locationSummary}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {appointment.allowedActions
            .filter((action) => action !== "reschedule")
            .map((action) => (
              <button
                key={action}
                type="button"
                disabled={loadingAction !== null}
                onClick={() => void runTransition(action)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {action.replace(/_/g, " ")}
              </button>
            ))}
        </div>
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Participants">
        <ul className="space-y-2 text-sm">
          {appointment.participants.map((participant) => (
            <li key={participant.participantId}>
              {participant.displayName} ({participant.role})
              {participant.isPrimary ? " · primary" : ""}
            </li>
          ))}
        </ul>
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Topics and agenda">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-slate-700">Client-requested topics</h3>
            {appointment.clientTopics.length === 0 ? (
              <p className="text-sm text-slate-600">No client topics yet.</p>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {appointment.clientTopics.map((topic) => (
                  <li key={topic.topicId}>{topic.label}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700">Adviser agenda</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {appointment.adviserAgenda.map((item) => (
                <li key={item.topicId}>{item.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Preparation">
        <p className="text-sm text-slate-700">
          State: {appointment.preparationState.replace(/_/g, " ")} · Checklist{" "}
          {appointment.checklistCompletedCount}/{appointment.checklistItems.length} complete (
          {appointment.checklistRequiredCount} required)
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {appointment.checklistItems.map((item) => (
            <li key={item.itemId}>
              {item.completed ? "✓" : "○"} {item.label}
              {item.required ? " (required)" : ""}
            </li>
          ))}
        </ul>
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Documents and planning">
        <p className="text-sm text-slate-700">
          Binder readiness: {appointment.binderReadiness.replace(/_/g, " ")}
        </p>
        {appointment.binderHref ? (
          <Link href={appointment.binderHref} className="mt-2 inline-block text-sm underline">
            Open relationship documents
          </Link>
        ) : null}
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Meeting Studio">
        <p className="text-sm text-slate-700">
          Link state: {appointment.meetingSessionLinkState.replace(/_/g, " ")}
        </p>
        {appointment.meetingSessionHref ? (
          <Link href={appointment.meetingSessionHref} className="mt-2 inline-block text-sm underline">
            Open Meeting Studio
          </Link>
        ) : null}
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Outcome and follow-up">
        <p className="text-sm text-slate-700">
          Follow-up state: {appointment.followUpState.replace(/_/g, " ")}
        </p>
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Google Calendar">
        <p className="text-sm text-slate-700">
          Sync status: {googleSyncStatus ?? "not_synced"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => void runGoogleSync("sync")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Sync to Google
          </button>
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => void runGoogleSync("retry")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Retry sync
          </button>
        </div>
      </CrmV2SectionPanel>

      <CrmV2SectionPanel title="Activity / history">
        <ul className="space-y-2 text-sm">
          {appointment.recentEvents.map((event) => (
            <li key={event.eventId}>
              {event.occurredAt}: {event.eventType}
              {event.fromState && event.toState
                ? ` (${event.fromState} → ${event.toState})`
                : ""}
            </li>
          ))}
        </ul>
      </CrmV2SectionPanel>
    </div>
  );
}
