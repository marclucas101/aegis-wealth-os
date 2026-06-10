"use client";

import Link from "next/link";

import type {
  AdvisorTaskRecord,
  AdvisorTaskStatus,
} from "@/components/aegis/advisor/AdvisorTaskComposer";
import {
  PRIORITY_LABELS,
  TASK_TYPE_LABELS,
} from "@/components/aegis/advisor/AdvisorTaskComposer";

interface AdvisorTaskCardProps {
  task: AdvisorTaskRecord;
  canMutate: boolean;
  updating: boolean;
  onStatusChange: (taskId: string, status: AdvisorTaskStatus) => void;
  onEdit?: (task: AdvisorTaskRecord) => void;
  showClient?: boolean;
}

const STATUS_LABELS: Record<AdvisorTaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priorityTone(priority: AdvisorTaskRecord["priority"]): string {
  switch (priority) {
    case "urgent":
      return "border-red-400/30 bg-red-400/10 text-red-200/85";
    case "high":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100/85";
    case "medium":
      return "border-[#D1A866]/25 bg-[#D1A866]/8 text-[#D1A866]/85";
    default:
      return "border-[#F3F1EA]/15 bg-[#071B2A]/50 text-[#F3F1EA]/55";
  }
}

function statusTone(status: AdvisorTaskStatus): string {
  switch (status) {
    case "completed":
      return "border-emerald-400/25 bg-emerald-400/8 text-emerald-200/80";
    case "cancelled":
      return "border-[#F3F1EA]/15 bg-[#071B2A]/40 text-[#F3F1EA]/40";
    case "in_progress":
      return "border-sky-400/25 bg-sky-400/8 text-sky-100/80";
    default:
      return "border-[#D1A866]/20 bg-[#071B2A]/50 text-[#F3F1EA]/65";
  }
}

export default function AdvisorTaskCard({
  task,
  canMutate,
  updating,
  onStatusChange,
  onEdit,
  showClient = false,
}: AdvisorTaskCardProps) {
  const isTerminal = task.status === "completed" || task.status === "cancelled";

  return (
    <article className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 p-4 transition-colors hover:border-[#D1A866]/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${priorityTone(task.priority)}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span className="rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/75">
              {TASK_TYPE_LABELS[task.taskType]}
            </span>
            <span
              className={`rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${statusTone(task.status)}`}
            >
              {STATUS_LABELS[task.status]}
            </span>
          </div>

          <p className="mt-3 text-sm font-light text-[#F3F1EA]">{task.title}</p>

          {task.description ? (
            <p className="mt-2 line-clamp-3 text-sm font-light leading-relaxed text-[#F3F1EA]/60">
              {task.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
            <span>Due {formatDate(task.dueDate)}</span>
            {showClient && task.clientId && task.clientDisplayName ? (
              <Link
                href={`/advisor/clients/${task.clientId}`}
                className="transition-colors hover:text-[#D1A866]"
              >
                {task.clientDisplayName}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {canMutate && !isTerminal ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {task.status === "open" ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => onStatusChange(task.id, "in_progress")}
              className="rounded-sm border border-sky-400/20 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-sky-100/75 transition hover:border-sky-400/35 disabled:opacity-45"
            >
              Start
            </button>
          ) : null}

          <button
            type="button"
            disabled={updating}
            onClick={() => onStatusChange(task.id, "completed")}
            className="rounded-sm border border-emerald-400/20 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-emerald-200/75 transition hover:border-emerald-400/35 disabled:opacity-45"
          >
            {updating ? "Saving…" : "Complete"}
          </button>

          <button
            type="button"
            disabled={updating}
            onClick={() => onStatusChange(task.id, "cancelled")}
            className="rounded-sm border border-red-400/20 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-red-200/70 transition hover:border-red-400/35 disabled:opacity-45"
          >
            Cancel
          </button>

          {onEdit ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => onEdit(task)}
              className="rounded-sm border border-[#D1A866]/20 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/60 transition hover:border-[#D1A866]/35 hover:text-[#F3F1EA] disabled:opacity-45"
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
