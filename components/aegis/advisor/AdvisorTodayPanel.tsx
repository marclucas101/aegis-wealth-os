"use client";

import Link from "next/link";
import { useMemo } from "react";

import type {
  AdvisorNotification,
  AdvisorNotificationsPayload,
} from "@/lib/supabase/advisorNotifications";
import type { AdvisorReviewPipeline } from "@/lib/supabase/advisorReviewPipeline";
import type { AdvisorTaskRecord } from "@/components/aegis/advisor/AdvisorTaskComposer";
import type { AdvisorTaskDashboard } from "@/lib/supabase/advisorTasks";
import type { ReactNode } from "react";

type TaskDashboardSlice = {
  dueToday: AdvisorTaskRecord[];
  overdue: AdvisorTaskRecord[];
  summary: {
    dueTodayCount: number;
    overdueCount: number;
  };
};

interface AdvisorTodayPanelProps {
  isLoading?: boolean;
  notifications?: AdvisorNotificationsPayload | null;
  notificationsError?: string | null;
  taskDashboard?: AdvisorTaskDashboard | null;
  tasksError?: string | null;
  reviewPipeline?: AdvisorReviewPipeline | null;
  reviewPipelineError?: string | null;
  onRefresh?: () => Promise<void>;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function TodaySection({
  title,
  count,
  emptyMessage,
  onViewAll,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  onViewAll?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/70">
          {title}
        </p>
        <span className="font-mono text-[10px] tabular-nums text-[#F3F1EA]/40">
          {count}
        </span>
      </div>
      <div className="mt-3">
        {count === 0 ? (
          <p className="text-xs font-light text-[#F3F1EA]/35">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
      {onViewAll && count > 0 ? (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#D1A866]/75 hover:text-[#D1A866]"
        >
          View all →
        </button>
      ) : null}
    </div>
  );
}

function TaskRow({ task }: { task: AdvisorTaskRecord }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#D1A866]/6 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-light text-[#F3F1EA]">
          {task.title}
        </p>
        {task.clientDisplayName ? (
          <p className="mt-0.5 truncate text-xs text-[#F3F1EA]/40">
            {task.clientDisplayName}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
        {task.priority}
      </span>
    </div>
  );
}

function UrgentNotificationRow({
  notification,
}: {
  notification: AdvisorNotification;
}) {
  return (
    <Link
      href={notification.actionHref}
      className="flex items-start justify-between gap-3 border-b border-[#D1A866]/6 py-2 last:border-b-0 transition-colors hover:text-[#D1A866]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-light text-[#F3F1EA]">
          {notification.title}
        </p>
        {notification.clientName ? (
          <p className="mt-0.5 truncate text-xs text-[#F3F1EA]/40">
            {notification.clientName}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-red-200/70">
        urgent
      </span>
    </Link>
  );
}

function ReviewRow({
  displayName,
  clientId,
  label,
}: {
  displayName: string;
  clientId: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#D1A866]/6 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-light text-[#F3F1EA]">
          {displayName}
        </p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
          {label}
        </p>
      </div>
      <Link
        href={`/advisor/clients/${clientId}`}
        className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[#D1A866]/75 hover:text-[#D1A866]"
      >
        Open
      </Link>
    </div>
  );
}

export default function AdvisorTodayPanel({
  isLoading = false,
  notifications = null,
  notificationsError = null,
  taskDashboard = null,
  tasksError = null,
  reviewPipeline = null,
  reviewPipelineError = null,
  onRefresh,
}: AdvisorTodayPanelProps) {
  const hasError =
    Boolean(notificationsError) ||
    Boolean(tasksError) ||
    Boolean(reviewPipelineError);

  const showNotifications = !notificationsError && notifications;
  const showTasks = !tasksError && taskDashboard;
  const showPipeline = !reviewPipelineError && reviewPipeline;

  const tasks = useMemo<TaskDashboardSlice | null>(() => {
    if (!showTasks || !taskDashboard) return null;

    return {
      dueToday: taskDashboard.dueToday.slice(0, 3),
      overdue: taskDashboard.overdue.slice(0, 3),
      summary: {
        dueTodayCount: taskDashboard.summary.dueTodayCount,
        overdueCount: taskDashboard.summary.overdueCount,
      },
    };
  }, [showTasks, taskDashboard]);

  const urgentNotifications = useMemo(() => {
    if (!showNotifications || !notifications) return [];
    return notifications.notifications
      .filter((notification) => notification.priority === "urgent")
      .slice(0, 3);
  }, [showNotifications, notifications]);

  const urgentCount = useMemo(() => {
    if (!showNotifications || !notifications) return 0;
    return notifications.notifications.filter(
      (notification) => notification.priority === "urgent",
    ).length;
  }, [showNotifications, notifications]);

  const pipeline = useMemo(() => {
    if (!showPipeline || !reviewPipeline) return null;

    return {
      overdue: reviewPipeline.overdue.slice(0, 3),
      dueThisMonth: reviewPipeline.dueThisMonth.slice(0, 3),
      summary: reviewPipeline.summary,
    };
  }, [showPipeline, reviewPipeline]);

  if (isLoading) {
    return (
      <section
        id="advisor-today"
        className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
        <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Today
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Loading urgent items, tasks, and review servicing…
          </p>
        </div>
        <div className="relative space-y-3 px-5 py-5">
          {[1, 2, 3, 4].map((slot) => (
            <div
              key={slot}
              className="animate-pulse rounded-sm border border-[#D1A866]/8 bg-[#071B2A]/35 p-4"
            >
              <div className="h-2 w-24 rounded bg-[#D1A866]/10" />
              <div className="mt-3 h-8 rounded bg-[#F3F1EA]/5" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (
    notifications === undefined &&
    taskDashboard === undefined &&
    reviewPipeline === undefined
  ) {
    return null;
  }

  if (
    notificationsError &&
    tasksError &&
    reviewPipelineError
  ) {
    return (
      <section
        id="advisor-today"
        className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load today&apos;s priorities.
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  if (!showNotifications && !showTasks && !showPipeline && hasError) {
    return (
      <section
        id="advisor-today"
        className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load today&apos;s priorities.
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  const reviewItems = pipeline
    ? [
        ...pipeline.overdue.map((client) => ({
          clientId: client.clientId,
          displayName: client.displayName,
          label: "Review overdue",
        })),
        ...pipeline.dueThisMonth.map((client) => ({
          clientId: client.clientId,
          displayName: client.displayName,
          label: "Due this month",
        })),
      ].slice(0, 4)
    : [];

  const reviewCount = pipeline
    ? pipeline.summary.overdueCount + pipeline.summary.dueThisMonthCount
    : 0;

  return (
    <section
      id="advisor-today"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Today
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Urgent items, due tasks, overdue work, and review servicing for this
          session.
        </p>
      </div>

      <div className="relative space-y-3 px-5 py-5">
        {notificationsError ? (
          <p className="text-xs font-light text-[#F3F1EA]/35">
            Urgent notifications unavailable.
          </p>
        ) : null}

        <TodaySection
          title="Urgent notifications"
          count={urgentCount}
          emptyMessage="No urgent alerts right now."
          onViewAll={() => scrollToSection("advisor-notifications")}
        >
          <div>
            {urgentNotifications.map((notification) => (
              <UrgentNotificationRow
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        </TodaySection>

        <TodaySection
          title="Tasks due today"
          count={tasks?.summary.dueTodayCount ?? 0}
          emptyMessage="No tasks due today."
          onViewAll={() => scrollToSection("advisor-tasks")}
        >
          {(tasks?.dueToday ?? []).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </TodaySection>

        <TodaySection
          title="Overdue tasks"
          count={tasks?.summary.overdueCount ?? 0}
          emptyMessage="No overdue tasks."
          onViewAll={() => scrollToSection("advisor-tasks")}
        >
          {(tasks?.overdue ?? []).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </TodaySection>

        <TodaySection
          title="Reviews due / overdue"
          count={reviewCount}
          emptyMessage="Review servicing is on track."
          onViewAll={() => scrollToSection("advisor-review-pipeline")}
        >
          {reviewItems.map((item) => (
            <ReviewRow
              key={`${item.clientId}-${item.label}`}
              clientId={item.clientId}
              displayName={item.displayName}
              label={item.label}
            />
          ))}
        </TodaySection>
      </div>
    </section>
  );
}
