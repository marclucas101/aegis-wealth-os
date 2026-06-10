"use client";

import Link from "next/link";

import type {
  AdvisorNotification,
  AdvisorNotificationPriority,
} from "@/lib/supabase/advisorNotifications";

interface AdvisorNotificationCardProps {
  notification: AdvisorNotification;
}

function priorityTone(priority: AdvisorNotificationPriority): string {
  switch (priority) {
    case "urgent":
      return "border-red-400/30 bg-red-400/8";
    case "high":
      return "border-amber-400/30 bg-amber-400/8";
    case "medium":
      return "border-[#D1A866]/25 bg-[#D1A866]/6";
    default:
      return "border-[#F3F1EA]/12 bg-[#071B2A]/40";
  }
}

function priorityLabelTone(priority: AdvisorNotificationPriority): string {
  switch (priority) {
    case "urgent":
      return "text-red-200/85";
    case "high":
      return "text-amber-100/85";
    case "medium":
      return "text-[#D1A866]/85";
    default:
      return "text-[#F3F1EA]/50";
  }
}

function typeLabel(type: AdvisorNotification["type"]): string {
  const labels: Record<AdvisorNotification["type"], string> = {
    task_overdue: "Task · Overdue",
    task_due_today: "Task · Due today",
    task_upcoming: "Task · Upcoming",
    review_overdue: "Review · Overdue",
    review_due: "Review · Due",
    high_risk_client: "Client · High risk",
    onboarding_incomplete: "Client · Onboarding",
    discover_missing: "Client · Discover",
    roadmap_stalled: "Client · Roadmap",
    recent_document_uploaded: "Document",
    recent_report_saved: "Report",
  };

  return labels[type];
}

function formatDetectedAt(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(dateString: string | null): string | null {
  if (!dateString) return null;

  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvisorNotificationCard({
  notification,
}: AdvisorNotificationCardProps) {
  const dueLabel = formatDueDate(notification.dueDate);

  return (
    <Link
      href={notification.actionHref}
      className={`group block rounded-sm border p-4 transition-colors hover:border-[#D1A866]/35 ${priorityTone(notification.priority)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/40">
              {typeLabel(notification.type)}
            </span>
            <span
              className={`text-[9px] font-medium uppercase tracking-[0.12em] ${priorityLabelTone(notification.priority)}`}
            >
              {notification.priority}
            </span>
          </div>
          <p className="text-sm font-light text-[#F3F1EA]">{notification.title}</p>
          <p className="text-xs font-light leading-relaxed text-[#F3F1EA]/45">
            {notification.description}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-light text-[#F3F1EA]/35">
            {formatDetectedAt(notification.detectedAt)}
          </p>
          {dueLabel ? (
            <p className="mt-1 text-[10px] font-light text-[#D1A866]/70">
              Due {dueLabel}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866]/70 transition-colors group-hover:text-[#D1A866]">
        {notification.actionLabel} →
      </p>
    </Link>
  );
}
