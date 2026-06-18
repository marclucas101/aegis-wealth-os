import "server-only";

import type { CalendarLocationType } from "@/lib/aegis/calendar";

function formatAppointmentDateTime(
  iso: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(iso));
}

function resolveLocationLabel(input: {
  locationType: CalendarLocationType;
  locationText?: string | null;
  phoneInstructions?: string | null;
  meetingUrl?: string | null;
}): string {
  switch (input.locationType) {
    case "physical":
      return input.locationText?.trim() || "In person";
    case "phone":
      return input.phoneInstructions?.trim() || "Phone consultation";
    case "google_meet":
      return input.meetingUrl?.trim() || "Google Meet (link in AEGIS)";
    default:
      return "See AEGIS for details";
  }
}

export function buildAdviserScheduledAppointmentEmail(input: {
  clientName: string;
  adviserName: string;
  appointmentLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationType: CalendarLocationType;
  locationText?: string | null;
  phoneInstructions?: string | null;
  meetingUrl?: string | null;
  clientVisibleNote?: string | null;
  viewUrl: string;
}): { subject: string; text: string; html: string } {
  const when = formatAppointmentDateTime(input.startsAt, input.timezone);
  const location = resolveLocationLabel(input);
  const subject = "Your adviser has scheduled an appointment";

  const lines = [
    `Dear ${input.clientName},`,
    "",
    `${input.adviserName} has scheduled an appointment with you in AEGIS.`,
    "",
    `Type: ${input.appointmentLabel}`,
    `When: ${when} (${input.timezone})`,
    `Location: ${location}`,
  ];

  if (input.meetingUrl) {
    lines.push(`Meeting link: ${input.meetingUrl}`);
  }

  if (input.clientVisibleNote?.trim()) {
    lines.push("", `Note from your adviser:`, input.clientVisibleNote.trim());
  }

  lines.push("", `View your appointment in AEGIS:`, input.viewUrl, "");

  const text = lines.join("\n");
  const html = `
    <p>Dear ${input.clientName},</p>
    <p><strong>${input.adviserName}</strong> has scheduled an appointment with you in AEGIS.</p>
    <ul>
      <li><strong>Type:</strong> ${input.appointmentLabel}</li>
      <li><strong>When:</strong> ${when} (${input.timezone})</li>
      <li><strong>Location:</strong> ${location}</li>
      ${input.meetingUrl ? `<li><strong>Meeting link:</strong> <a href="${input.meetingUrl}">${input.meetingUrl}</a></li>` : ""}
    </ul>
    ${input.clientVisibleNote?.trim() ? `<p><strong>Note from your adviser:</strong><br/>${input.clientVisibleNote.trim()}</p>` : ""}
    <p><a href="${input.viewUrl}">View your appointment in AEGIS</a></p>
  `.trim();

  return { subject, text, html };
}

export function resolveAppointmentViewUrl(): string {
  const base =
    process.env.BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  return `${base.replace(/\/$/, "")}/my-adviser`;
}
