"use client";

import { useCallback, useEffect, useState } from "react";

import AdvisorTaskComposer, {
  taskToComposerValues,
  type AdvisorTaskRecord,
  type AdvisorTaskStatus,
  type TaskComposerValues,
} from "@/components/aegis/advisor/AdvisorTaskComposer";
import AdvisorTaskList from "@/components/aegis/advisor/AdvisorTaskList";

type TaskDashboard = {
  dueToday: AdvisorTaskRecord[];
  overdue: AdvisorTaskRecord[];
  upcoming: AdvisorTaskRecord[];
  highPriority: AdvisorTaskRecord[];
  recentlyCompleted: AdvisorTaskRecord[];
  summary: {
    dueTodayCount: number;
    overdueCount: number;
    upcomingCount: number;
    highPriorityCount: number;
    recentlyCompletedCount: number;
  };
};

type TaskSection = {
  key: keyof Pick<
    TaskDashboard,
    | "dueToday"
    | "overdue"
    | "upcoming"
    | "highPriority"
    | "recentlyCompleted"
  >;
  label: string;
  description: string;
};

const SECTIONS: TaskSection[] = [
  {
    key: "overdue",
    label: "Overdue",
    description: "Open tasks past their due date",
  },
  {
    key: "dueToday",
    label: "Due Today",
    description: "Tasks due today across your book",
  },
  {
    key: "upcoming",
    label: "Upcoming",
    description: "Tasks due within the next 14 days",
  },
  {
    key: "highPriority",
    label: "High Priority",
    description: "High and urgent open tasks",
  },
  {
    key: "recentlyCompleted",
    label: "Recently Completed",
    description: "Tasks completed in the last 30 days",
  },
];

type PanelMode = "loading" | "ready" | "error";

type SaveState = "idle" | "saved" | "error";

export default function AdvisorTaskPanel() {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null);
  const [activeSection, setActiveSection] =
    useState<TaskSection["key"]>("overdue");

  const [creating, setCreating] = useState(false);
  const [createSaveState, setCreateSaveState] = useState<SaveState>("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [composerResetKey, setComposerResetKey] = useState(0);

  const [editingTask, setEditingTask] = useState<AdvisorTaskRecord | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateSaveState, setUpdateSaveState] = useState<SaveState>("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadDashboard = useCallback(async () => {
    setMode("loading");

    try {
      const response = await fetch("/api/advisor/tasks", { cache: "no-store" });
      const data = (await response.json()) as
        | ({ ok: true } & TaskDashboard & {
            viewer: { userId: string; role: "advisor" | "admin" };
          })
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setMode("error");
        return;
      }

      setDashboard(data);
      setCurrentUserId(data.viewer.userId);
      setIsAdmin(data.viewer.role === "admin");

      const firstNonEmpty = SECTIONS.find(
        (section) => data[section.key].length > 0,
      );
      if (firstNonEmpty) {
        setActiveSection(firstNonEmpty.key);
      }

      setMode("ready");
    } catch {
      setMode("error");
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleCreate(values: TaskComposerValues) {
    setCreating(true);
    setCreateSaveState("idle");
    setCreateError(null);

    try {
      const response = await fetch("/api/advisor/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          description: values.description || null,
          task_type: values.taskType,
          priority: values.priority,
          due_date: values.dueDate || null,
        }),
      });

      const data = (await response.json()) as
        | { ok: true; task: AdvisorTaskRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setCreateSaveState("error");
        setCreateError(
          data.ok ? "Failed to create task." : (data.error ?? "Failed to create task."),
        );
        return;
      }

      setCreateSaveState("saved");
      setComposerResetKey((key) => key + 1);
      window.setTimeout(() => setCreateSaveState("idle"), 2000);
      await loadDashboard();
    } catch {
      setCreateSaveState("error");
      setCreateError("Failed to create task.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(values: TaskComposerValues) {
    if (!editingTask) return;

    setUpdating(true);
    setUpdateSaveState("idle");
    setUpdateError(null);

    try {
      const response = await fetch(`/api/advisor/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          description: values.description || null,
          task_type: values.taskType,
          priority: values.priority,
          due_date: values.dueDate || null,
        }),
      });

      const data = (await response.json()) as
        | { ok: true; task: AdvisorTaskRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setUpdateSaveState("error");
        setUpdateError(
          data.ok ? "Failed to update task." : (data.error ?? "Failed to update task."),
        );
        return;
      }

      setEditingTask(null);
      setUpdateSaveState("saved");
      window.setTimeout(() => setUpdateSaveState("idle"), 2000);
      await loadDashboard();
    } catch {
      setUpdateSaveState("error");
      setUpdateError("Failed to update task.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleStatusChange(taskId: string, status: AdvisorTaskStatus) {
    setUpdatingTaskId(taskId);
    setStatusError(null);

    try {
      const response = await fetch(`/api/advisor/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = (await response.json()) as
        | { ok: true; task: AdvisorTaskRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setStatusError(
          data.ok ? "Failed to update task." : (data.error ?? "Failed to update task."),
        );
        return;
      }

      await loadDashboard();
    } catch {
      setStatusError("Failed to update task.");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  if (mode === "loading") {
    return (
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-12 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">Loading tasks…</p>
      </section>
    );
  }

  if (mode === "error" || !dashboard) {
    return (
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load advisor tasks.
        </p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
        >
          Retry
        </button>
      </section>
    );
  }

  const activeTasks = dashboard[activeSection];
  const activeMeta = SECTIONS.find((section) => section.key === activeSection)!;

  return (
    <section
      id="advisor-tasks"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Advisor Tasks
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Follow-ups, reviews, document actions, and priority work across your
          client book.
        </p>
      </div>

      <div className="relative space-y-6 px-5 py-5">
        <AdvisorTaskComposer
          key={composerResetKey}
          mode="create"
          saving={creating}
          saveState={createSaveState}
          errorMessage={createError}
          onSubmit={handleCreate}
        />

        {editingTask ? (
          <div className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/30 p-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
              Edit Task
            </p>
            <AdvisorTaskComposer
              mode="edit"
              initialValues={taskToComposerValues(editingTask)}
              saving={updating}
              saveState={updateSaveState}
              errorMessage={updateError}
              onSubmit={handleUpdate}
              onCancel={() => {
                setEditingTask(null);
                setUpdateSaveState("idle");
                setUpdateError(null);
              }}
            />
          </div>
        ) : null}

        {statusError ? (
          <p className="text-sm font-light text-red-200/80">{statusError}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-[#D1A866]/10 pb-3">
          {SECTIONS.map((section) => {
            const count = dashboard.summary[
              `${section.key}Count` as keyof TaskDashboard["summary"]
            ] as number;
            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.12em] transition-colors ${
                  isActive
                    ? "border-[#D1A866]/40 bg-[#D1A866]/10 text-[#D1A866]"
                    : "border-[#D1A866]/15 bg-[#071B2A]/40 text-[#F3F1EA]/50 hover:border-[#D1A866]/25 hover:text-[#F3F1EA]/70"
                }`}
              >
                {section.label}
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

        <div>
          <p className="text-xs font-light text-[#F3F1EA]/40">
            {activeMeta.description}
          </p>
          <div className="mt-4">
            <AdvisorTaskList
              tasks={activeTasks}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              updatingTaskId={updatingTaskId}
              onStatusChange={handleStatusChange}
              onEdit={setEditingTask}
              showClient
            />
          </div>
        </div>
      </div>
    </section>
  );
}
