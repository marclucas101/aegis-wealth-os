"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  AdvisorNotification,
  AdvisorNotificationsPayload,
} from "@/lib/supabase/advisorNotifications";
import type { AdvisorReviewPipeline } from "@/lib/supabase/advisorReviewPipeline";
import type { AdvisorTaskRecord } from "@/components/aegis/advisor/AdvisorTaskComposer";
import type { ReactNode } from "react";

type TaskDashboardSlice = {
  dueToday: AdvisorTaskRecord[];
  overdue: AdvisorTaskRecord[];
  summary: {
    dueTodayCount: number;
    overdueCount: number;
  };
};

type LoadState = "loading" | "ready" | "error";

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

export default function AdvisorTodayPanel() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [urgentNotifications, setUrgentNotifications] = useState<
    AdvisorNotification[]
  >([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [tasks, setTasks] = useState<TaskDashboardSlice | null>(null);
  const [pipeline, setPipeline] = useState<{
    overdue: AdvisorReviewPipeline["overdue"];
    dueThisMonth: AdvisorReviewPipeline["dueThisMonth"];
    summary: AdvisorReviewPipeline["summary"];
  } | null>(null);

  const loadToday = useCallback(async () => {
    setLoadState("loading");

    try {
      const [notifRes, taskRes, pipelineRes] = await Promise.all([
        fetch("/api/advisor/notifications", { cache: "no-store" }),
        fetch("/api/advisor/tasks", { cache: "no-store" }),
        fetch("/api/advisor/review-pipeline", { cache: "no-store" }),
      ]);

      if (!notifRes.ok || !taskRes.ok || !pipelineRes.ok) {
        setLoadState("error");
        return;
      }

      const notifData = (await notifRes.json()) as
        | ({ ok: true } & AdvisorNotificationsPayload)
        | { ok: false };
      const taskData = (await taskRes.json()) as
        | ({ ok: true } & TaskDashboardSlice)
        | { ok: false };
      const pipelineData = (await pipelineRes.json()) as
        | ({ ok: true } & AdvisorReviewPipeline)
        | { ok: false };

      if (!notifData.ok || !taskData.ok || !pipelineData.ok) {
        setLoadState("error");
        return;
      }

      const urgent = notifData.notifications.filter(
        (n) => n.priority === "urgent",
      );
      setUrgentCount(urgent.length);
      setUrgentNotifications(urgent.slice(0, 3));
      setTasks({
        dueToday: taskData.dueToday.slice(0, 3),
        overdue: taskData.overdue.slice(0, 3),
        summary: {
          dueTodayCount: taskData.summary.dueTodayCount,
          overdueCount: taskData.summary.overdueCount,
        },
      });
      setPipeline({
        overdue: pipelineData.overdue.slice(0, 3),
        dueThisMonth: pipelineData.dueThisMonth.slice(0, 3),
        summary: pipelineData.summary,
      });
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  if (loadState === "loading") {
    return (
      <section
        id="advisor-today"
        className="scroll-mt-24 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-12 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading today&apos;s priorities…
        </p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section
        id="advisor-today"
        className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center"
      >
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load today&apos;s priorities.
        </p>
        <button
          type="button"
          onClick={() => void loadToday()}
          className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
        >
          Retry
        </button>
      </section>
    );
  }

  const reviewItems = [
    ...pipeline!.overdue.map((c) => ({
      clientId: c.clientId,
      displayName: c.displayName,
      label: "Review overdue",
    })),
    ...pipeline!.dueThisMonth.map((c) => ({
      clientId: c.clientId,
      displayName: c.displayName,
      label: "Due this month",
    })),
  ].slice(0, 4);

  const reviewCount =
    pipeline!.summary.overdueCount + pipeline!.summary.dueThisMonthCount;

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
          count={tasks!.summary.dueTodayCount}
          emptyMessage="No tasks due today."
          onViewAll={() => scrollToSection("advisor-tasks")}
        >
          {tasks!.dueToday.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </TodaySection>

        <TodaySection
          title="Overdue tasks"
          count={tasks!.summary.overdueCount}
          emptyMessage="No overdue tasks."
          onViewAll={() => scrollToSection("advisor-tasks")}
        >
          {tasks!.overdue.map((task) => (
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
