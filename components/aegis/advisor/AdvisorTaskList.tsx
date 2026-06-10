"use client";

import AdvisorTaskCard from "@/components/aegis/advisor/AdvisorTaskCard";
import type {
  AdvisorTaskRecord,
  AdvisorTaskStatus,
} from "@/components/aegis/advisor/AdvisorTaskComposer";

interface AdvisorTaskListProps {
  tasks: AdvisorTaskRecord[];
  currentUserId: string | null;
  isAdmin: boolean;
  updatingTaskId: string | null;
  onStatusChange: (taskId: string, status: AdvisorTaskStatus) => void;
  onEdit?: (task: AdvisorTaskRecord) => void;
  showClient?: boolean;
  emptyMessage?: string;
}

function canMutateTask(
  task: AdvisorTaskRecord,
  currentUserId: string | null,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (!currentUserId) return false;

  if (
    task.assignedToUserId === currentUserId ||
    task.createdByUserId === currentUserId
  ) {
    return true;
  }

  return task.clientId !== null;
}

export default function AdvisorTaskList({
  tasks,
  currentUserId,
  isAdmin,
  updatingTaskId,
  onStatusChange,
  onEdit,
  showClient = false,
  emptyMessage = "No tasks in this section.",
}: AdvisorTaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-light text-[#F3F1EA]/45">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <AdvisorTaskCard
          key={task.id}
          task={task}
          canMutate={canMutateTask(task, currentUserId, isAdmin)}
          updating={updatingTaskId === task.id}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          showClient={showClient}
        />
      ))}
    </div>
  );
}
