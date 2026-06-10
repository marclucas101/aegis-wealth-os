"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AdvisorNotificationCard from "@/components/aegis/advisor/AdvisorNotificationCard";
import AdvisorReminderSummary, {
  type NotificationFilter,
} from "@/components/aegis/advisor/AdvisorReminderSummary";
import type {
  AdvisorNotification,
  AdvisorNotificationsPayload,
} from "@/lib/supabase/advisorNotifications";

type PanelMode = "loading" | "ready" | "error";

const TASK_TYPES = new Set([
  "task_overdue",
  "task_due_today",
  "task_upcoming",
]);

const REVIEW_TYPES = new Set(["review_overdue", "review_due"]);

const CLIENT_TYPES = new Set([
  "high_risk_client",
  "onboarding_incomplete",
  "discover_missing",
  "roadmap_stalled",
]);

const DOCUMENT_TYPES = new Set([
  "recent_document_uploaded",
  "recent_report_saved",
]);

function filterNotifications(
  notifications: AdvisorNotification[],
  filter: NotificationFilter,
): AdvisorNotification[] {
  switch (filter) {
    case "urgent":
      return notifications.filter((n) => n.priority === "urgent");
    case "tasks":
      return notifications.filter((n) => TASK_TYPES.has(n.type));
    case "reviews":
      return notifications.filter((n) => REVIEW_TYPES.has(n.type));
    case "clients":
      return notifications.filter((n) => CLIENT_TYPES.has(n.type));
    case "documents":
      return notifications.filter((n) => DOCUMENT_TYPES.has(n.type));
    default:
      return notifications;
  }
}

export default function AdvisorNotificationCenter() {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [payload, setPayload] = useState<AdvisorNotificationsPayload | null>(
    null,
  );
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");

  const loadNotifications = useCallback(async () => {
    setMode("loading");

    try {
      const response = await fetch("/api/advisor/notifications", {
        cache: "no-store",
      });

      if (!response.ok) {
        setMode("error");
        return;
      }

      const data = (await response.json()) as
        | ({ ok: true } & AdvisorNotificationsPayload)
        | { ok: false };

      if (!data.ok) {
        setMode("error");
        return;
      }

      setPayload({
        notifications: data.notifications,
        summary: data.summary,
      });
      setMode("ready");
    } catch {
      setMode("error");
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    if (!payload) return [];
    return filterNotifications(payload.notifications, activeFilter);
  }, [payload, activeFilter]);

  if (mode === "loading") {
    return (
      <section
        id="advisor-notifications"
        className="scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-12 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading notifications…
        </p>
      </section>
    );
  }

  if (mode === "error" || !payload) {
    return (
      <section
        id="advisor-notifications"
        className="scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load advisor notifications.
        </p>
        <button
          type="button"
          onClick={() => void loadNotifications()}
          className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section
      id="advisor-notifications"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Notification Center
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Read-only reminders for tasks, reviews, client gaps, and recent
          document or report activity.
        </p>
      </div>

      <div className="relative space-y-6 px-5 py-5">
        <AdvisorReminderSummary
          summary={payload.summary}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {filteredNotifications.length === 0 ? (
          <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/30 px-6 py-12 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
              All clear
            </p>
            <p className="mt-3 text-sm font-light text-[#F3F1EA]/45">
              {activeFilter === "all"
                ? "No advisor notifications right now. Tasks, reviews, and client activity are up to date."
                : "No notifications match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <AdvisorNotificationCard
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
