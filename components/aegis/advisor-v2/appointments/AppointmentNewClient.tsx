"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import CrmV2SectionPanel from "@/components/aegis/advisor-v2/CrmV2SectionPanel";
import {
  CRM_APPOINTMENT_TEMPLATE_KEYS,
  CRM_APPOINTMENT_TEMPLATES,
} from "@/lib/crm-v2/appointments/templates";
import type { CrmAssignedRelationshipOption } from "@/lib/crm-v2/appointments/types";

interface AppointmentNewClientProps {
  relationships: CrmAssignedRelationshipOption[];
  initialRelationshipId?: string;
}

export default function AppointmentNewClient({
  relationships,
  initialRelationshipId,
}: AppointmentNewClientProps) {
  const router = useRouter();
  const [relationshipId, setRelationshipId] = useState(initialRelationshipId ?? "");
  const [templateKey, setTemplateKey] = useState(CRM_APPOINTMENT_TEMPLATE_KEYS[0]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [deliveryMode, setDeliveryMode] = useState<"google_meet" | "physical" | "phone">(
    "google_meet",
  );
  const [lifecycleStatus, setLifecycleStatus] = useState<"proposed" | "confirmed">("proposed");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const template = CRM_APPOINTMENT_TEMPLATES[templateKey];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const startsAt = new Date(`${date}T${startTime}:00`).toISOString();
      const endsAt = new Date(`${date}T${endTime}:00`).toISOString();

      const response = await fetch("/api/advisor-v2/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationshipId,
          templateKey,
          lifecycleStatus,
          startsAt,
          endsAt,
          timezone,
          deliveryMode,
          title: title.trim() || null,
          adviserAgenda: template.defaultAgendaPrompts,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        appointmentId?: string;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.appointmentId) {
        setError(payload.error ?? "Failed to create appointment");
        return;
      }

      router.push(`/advisor-v2/appointments/${payload.appointmentId}`);
    } catch {
      setError("Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <CrmV2PageHeader
        title="New appointment"
        subtitle="Create an appointment for an assigned relationship."
      />

      <div className="mb-4">
        <Link href="/advisor-v2/appointments" className="text-sm font-medium text-slate-700 underline">
          Back to appointments
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <CrmV2SectionPanel title="Relationship and type">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="relationship" className="mb-1 block text-sm font-medium text-slate-700">
                Relationship
              </label>
              <select
                id="relationship"
                required
                value={relationshipId}
                onChange={(event) => setRelationshipId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select relationship</option>
                {relationships.map((item) => (
                  <option key={item.relationshipId} value={item.relationshipId}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="template" className="mb-1 block text-sm font-medium text-slate-700">
                Appointment type
              </label>
              <select
                id="template"
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value as typeof templateKey)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {CRM_APPOINTMENT_TEMPLATE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {CRM_APPOINTMENT_TEMPLATES[key].displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CrmV2SectionPanel>

        <CrmV2SectionPanel title="Schedule">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="date" className="mb-1 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-slate-700">
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                required
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="startTime" className="mb-1 block text-sm font-medium text-slate-700">
                Start time
              </label>
              <input
                id="startTime"
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="endTime" className="mb-1 block text-sm font-medium text-slate-700">
                End time
              </label>
              <input
                id="endTime"
                type="time"
                required
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CrmV2SectionPanel>

        <CrmV2SectionPanel title="Delivery">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="deliveryMode" className="mb-1 block text-sm font-medium text-slate-700">
                Delivery mode
              </label>
              <select
                id="deliveryMode"
                value={deliveryMode}
                onChange={(event) =>
                  setDeliveryMode(event.target.value as typeof deliveryMode)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="google_meet">Video call</option>
                <option value="physical">In person</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <label htmlFor="lifecycleStatus" className="mb-1 block text-sm font-medium text-slate-700">
                Initial status
              </label>
              <select
                id="lifecycleStatus"
                value={lifecycleStatus}
                onChange={(event) =>
                  setLifecycleStatus(event.target.value as typeof lifecycleStatus)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="proposed">Proposed</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
                Purpose (optional)
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CrmV2SectionPanel>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          {submitting ? "Creating…" : "Create appointment"}
        </button>
      </form>
    </div>
  );
}
