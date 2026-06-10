"use client";

import { useEffect, useState } from "react";

import AdvisorTaskComposer, {
  taskToComposerValues,
  type AdvisorTaskRecord,
  type AdvisorTaskStatus,
  type TaskComposerValues,
} from "@/components/aegis/advisor/AdvisorTaskComposer";
import AdvisorTaskList from "@/components/aegis/advisor/AdvisorTaskList";

type SaveState = "idle" | "saved" | "error";

interface AdvisorClientTasksPanelProps {
  clientId: string;
  initialTasks: AdvisorTaskRecord[] | null;
  error: string | null;
  viewer: { userId: string; role: "advisor" | "admin" } | null;
  onRetry?: () => void;
  onOpenTaskCountChange?: (count: number) => void;
}

export default function AdvisorClientTasksPanel({
  clientId,
  initialTasks,
  error,
  viewer,
  onRetry,
  onOpenTaskCountChange,
}: AdvisorClientTasksPanelProps) {
  const [tasks, setTasks] = useState<AdvisorTaskRecord[]>(initialTasks ?? []);
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);

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

  const isLoading = initialTasks === null && error === null;
  const currentUserId = viewer?.userId ?? null;
  const isAdmin = viewer?.role === "admin";

  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    if (initialTasks !== null) {
      setTasks(initialTasks);
    }
  }

  const loadError = error;

  useEffect(() => {
    if (!onOpenTaskCountChange) return;
    const open = tasks.filter(
      (task) => task.status === "open" || task.status === "in_progress",
    ).length;
    onOpenTaskCountChange(open);
  }, [tasks, onOpenTaskCountChange]);

  async function handleCreate(values: TaskComposerValues) {
    setCreating(true);
    setCreateSaveState("idle");
    setCreateError(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticTask: AdvisorTaskRecord = {
      id: optimisticId,
      clientId,
      clientDisplayName: null,
      assignedToUserId: currentUserId ?? "",
      createdByUserId: currentUserId ?? "",
      title: values.title,
      description: values.description || null,
      taskType: values.taskType,
      priority: values.priority,
      status: "open",
      dueDate: values.dueDate || null,
      completedAt: null,
      relatedEntityType: null,
      relatedEntityId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks((current) => [optimisticTask, ...current]);

    try {
      const response = await fetch("/api/advisor/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
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
        setTasks((current) => current.filter((task) => task.id !== optimisticId));
        setCreateSaveState("error");
        setCreateError(
          data.ok ? "Failed to create task." : (data.error ?? "Failed to create task."),
        );
        return;
      }

      setTasks((current) =>
        current.map((task) => (task.id === optimisticId ? data.task : task)),
      );
      setCreateSaveState("saved");
      setComposerResetKey((key) => key + 1);
      window.setTimeout(() => setCreateSaveState("idle"), 2000);
    } catch {
      setTasks((current) => current.filter((task) => task.id !== optimisticId));
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

    const previousTasks = tasks;
    const taskId = editingTask.id;

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title: values.title,
              description: values.description || null,
              taskType: values.taskType,
              priority: values.priority,
              dueDate: values.dueDate || null,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    );

    try {
      const response = await fetch(`/api/advisor/tasks/${taskId}`, {
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
        setTasks(previousTasks);
        setUpdateSaveState("error");
        setUpdateError(
          data.ok ? "Failed to update task." : (data.error ?? "Failed to update task."),
        );
        return;
      }

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? data.task : task)),
      );
      setEditingTask(null);
      setUpdateSaveState("saved");
      window.setTimeout(() => setUpdateSaveState("idle"), 2000);
    } catch {
      setTasks(previousTasks);
      setUpdateSaveState("error");
      setUpdateError("Failed to update task.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleStatusChange(taskId: string, status: AdvisorTaskStatus) {
    setUpdatingTaskId(taskId);
    setStatusError(null);

    const previousTasks = tasks;
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              completedAt:
                status === "completed" ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    );

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
        setTasks(previousTasks);
        setStatusError(
          data.ok ? "Failed to update task." : (data.error ?? "Failed to update task."),
        );
        return;
      }

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? data.task : task)),
      );
    } catch {
      setTasks(previousTasks);
      setStatusError("Failed to update task.");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const openTasks = tasks.filter(
    (task) => task.status === "open" || task.status === "in_progress",
  );
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Client Tasks
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Follow-ups, reviews, documents, and roadmap actions for this client
        </p>
      </div>

      <div className="relative space-y-6 px-5 py-5">
        {isLoading ? (
          <p className="text-sm font-light text-[#F3F1EA]/45">Loading tasks…</p>
        ) : null}

        {loadError ? (
          <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-4 py-3">
            <p className="text-sm font-light text-red-200/80">{loadError}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !loadError ? (
          <>
            <AdvisorTaskComposer
              key={composerResetKey}
              mode="create"
              saving={creating}
              saveState={createSaveState}
              errorMessage={createError}
              onSubmit={handleCreate}
            />

            {statusError ? (
              <p className="text-sm font-light text-red-200/80">{statusError}</p>
            ) : null}

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

            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/40">
                Open Tasks ({openTasks.length})
              </p>
              <AdvisorTaskList
                tasks={openTasks}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                updatingTaskId={updatingTaskId}
                onStatusChange={handleStatusChange}
                onEdit={setEditingTask}
                emptyMessage="No open tasks for this client."
              />
            </div>

            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/40">
                Completed ({completedTasks.length})
              </p>
              <AdvisorTaskList
                tasks={completedTasks}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                updatingTaskId={updatingTaskId}
                onStatusChange={handleStatusChange}
                emptyMessage="No completed tasks yet."
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
