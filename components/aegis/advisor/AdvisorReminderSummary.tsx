"use client";

import AdvisorMetricCard from "@/components/aegis/advisor/AdvisorMetricCard";
import type { AdvisorNotificationSummary } from "@/lib/supabase/advisorNotifications";

interface AdvisorReminderSummaryProps {
  summary: AdvisorNotificationSummary;
  activeFilter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
}

export type NotificationFilter =
  | "all"
  | "urgent"
  | "tasks"
  | "reviews"
  | "clients"
  | "documents";

const FILTER_OPTIONS: {
  key: NotificationFilter;
  label: string;
  countKey: keyof AdvisorNotificationSummary | null;
}[] = [
  { key: "all", label: "All", countKey: "totalCount" },
  { key: "urgent", label: "Urgent", countKey: "urgentCount" },
  { key: "tasks", label: "Tasks", countKey: "taskCount" },
  { key: "reviews", label: "Reviews", countKey: "reviewCount" },
  { key: "clients", label: "Clients", countKey: "clientCount" },
  { key: "documents", label: "Documents", countKey: "documentCount" },
];

export default function AdvisorReminderSummary({
  summary,
  activeFilter,
  onFilterChange,
}: AdvisorReminderSummaryProps) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Reminder Summary
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Urgent advisor actions computed from tasks, reviews, client gaps, and
          recent activity.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdvisorMetricCard
          label="Urgent alerts"
          value={summary.urgentCount}
          sublabel={`${summary.totalCount} total notifications`}
          highlight={summary.urgentCount > 0}
        />
        <AdvisorMetricCard
          label="Overdue tasks"
          value={summary.overdueTaskCount}
          sublabel={`${summary.dueTodayTaskCount} due today`}
        />
        <AdvisorMetricCard
          label="Overdue reviews"
          value={summary.overdueReviewCount}
          sublabel={`${summary.reviewCount} review reminders`}
        />
        <AdvisorMetricCard
          label="Client alerts"
          value={summary.clientCount}
          sublabel={`${summary.documentCount} document/report updates`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const count =
            option.countKey != null ? summary[option.countKey] : summary.totalCount;
          const isActive = activeFilter === option.key;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterChange(option.key)}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.12em] transition-colors ${
                isActive
                  ? "border-[#D1A866]/40 bg-[#D1A866]/10 text-[#D1A866]"
                  : "border-[#D1A866]/15 bg-[#071B2A]/40 text-[#F3F1EA]/50 hover:border-[#D1A866]/25 hover:text-[#F3F1EA]/70"
              }`}
            >
              {option.label}
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  isActive ? "text-[#D1A866]" : "text-[#F3F1EA]/40"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
