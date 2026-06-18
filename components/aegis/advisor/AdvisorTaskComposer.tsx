"use client";

import { useState } from "react";

export const ADVISOR_TASK_TYPES = [
  "general",
  "review",
  "follow_up",
  "document",
  "roadmap",
  "risk",
  "client_birthday",
] as const;

export const ADVISOR_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const ADVISOR_TASK_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type AdvisorTaskType = (typeof ADVISOR_TASK_TYPES)[number];
export type AdvisorTaskPriority = (typeof ADVISOR_TASK_PRIORITIES)[number];
export type AdvisorTaskStatus = (typeof ADVISOR_TASK_STATUSES)[number];

export type AdvisorTaskRecord = {
  id: string;
  clientId: string | null;
  clientDisplayName: string | null;
  assignedToUserId: string;
  createdByUserId: string;
  title: string;
  description: string | null;
  taskType: AdvisorTaskType;
  priority: AdvisorTaskPriority;
  status: AdvisorTaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  sourceKey?: string | null;
  dismissedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TaskComposerMode = "create" | "edit";

export type TaskComposerValues = {
  title: string;
  description: string;
  taskType: AdvisorTaskType;
  priority: AdvisorTaskPriority;
  dueDate: string;
};

interface AdvisorTaskComposerProps {
  mode: TaskComposerMode;
  initialValues?: TaskComposerValues;
  saving: boolean;
  saveState: "idle" | "saved" | "error";
  errorMessage?: string | null;
  onSubmit: (values: TaskComposerValues) => void;
  onCancel?: () => void;
}

const TASK_TYPE_LABELS: Record<AdvisorTaskType, string> = {
  general: "General",
  review: "Review",
  follow_up: "Follow-up",
  document: "Document",
  roadmap: "Roadmap",
  risk: "Risk",
  client_birthday: "Birthday",
};

const PRIORITY_LABELS: Record<AdvisorTaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const EMPTY_VALUES: TaskComposerValues = {
  title: "",
  description: "",
  taskType: "general",
  priority: "medium",
  dueDate: "",
};

export default function AdvisorTaskComposer({
  mode,
  initialValues,
  saving,
  saveState,
  errorMessage,
  onSubmit,
  onCancel,
}: AdvisorTaskComposerProps) {
  const resolvedInitial = initialValues ?? EMPTY_VALUES;
  const [values, setValues] = useState<TaskComposerValues>(resolvedInitial);
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);
  const [prevMode, setPrevMode] = useState(mode);

  if (initialValues !== prevInitialValues || mode !== prevMode) {
    setPrevInitialValues(initialValues);
    setPrevMode(mode);
    setValues(resolvedInitial);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.title.trim() || saving) {
      return;
    }

    onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      taskType: values.taskType,
      priority: values.priority,
      dueDate: values.dueDate.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4 sm:p-5"
    >
      <div className="grid gap-4">
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
            Title
          </span>
          <input
            type="text"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            disabled={saving}
            placeholder="Task headline"
            className="mt-2 w-full rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] placeholder:text-[#F3F1EA]/25 outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
              Task Type
            </span>
            <select
              value={values.taskType}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  taskType: event.target.value as AdvisorTaskType,
                }))
              }
              disabled={saving}
              className="mt-2 w-full rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
            >
              {ADVISOR_TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TASK_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
              Priority
            </span>
            <select
              value={values.priority}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  priority: event.target.value as AdvisorTaskPriority,
                }))
              }
              disabled={saving}
              className="mt-2 w-full rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
            >
              {ADVISOR_TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
              Due Date
            </span>
            <input
              type="date"
              value={values.dueDate}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
              disabled={saving}
              className="mt-2 w-full rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
            Description
          </span>
          <textarea
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            disabled={saving}
            rows={3}
            placeholder="Optional context, next steps, or linked review/document notes…"
            className="mt-2 w-full resize-y rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light leading-relaxed text-[#F3F1EA] placeholder:text-[#F3F1EA]/25 outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || !values.title.trim()}
          className="rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/12 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA] transition hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Create Task"
              : "Update Task"}
        </button>

        {mode === "edit" && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-sm border border-[#D1A866]/15 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition hover:text-[#F3F1EA] disabled:opacity-45"
          >
            Cancel
          </button>
        ) : null}

        {saveState === "saved" ? (
          <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-300/75">
            Saved
          </span>
        ) : null}

        {saveState === "error" && errorMessage ? (
          <span className="text-[11px] text-red-200/80">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}

export function taskToComposerValues(task: AdvisorTaskRecord): TaskComposerValues {
  return {
    title: task.title,
    description: task.description ?? "",
    taskType: task.taskType,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
  };
}

export { TASK_TYPE_LABELS, PRIORITY_LABELS };
