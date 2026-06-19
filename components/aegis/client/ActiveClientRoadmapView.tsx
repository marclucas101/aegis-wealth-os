"use client";

import type { ClientSafeRoadmapPayload, ClientSafeRoadmapTask } from "@/lib/compliance/clientRoadmapData";

const STATUS_LABELS: Record<ClientSafeRoadmapTask["displayStatus"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  waiting_on_you: "Waiting on you",
  with_your_adviser: "With your adviser",
  completed: "Completed",
};

function TaskList({
  title,
  tasks,
}: {
  title: string;
  tasks: ClientSafeRoadmapTask[];
}) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-5">
      <h2 className="text-sm font-medium text-[#F3F1EA]/85">{title}</h2>
      <ul className="mt-4 space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="rounded-sm border border-[#D1A866]/10 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[#F3F1EA]/80">{task.title}</p>
              <span className="text-[10px] uppercase tracking-wider text-[#D1A866]/70">
                {STATUS_LABELS[task.displayStatus]}
              </span>
            </div>
            {task.adviserStatusLabel ? (
              <p className="mt-1 text-xs text-[#F3F1EA]/45">{task.adviserStatusLabel}</p>
            ) : null}
            {task.taskOwner === "client" ? (
              <p className="mt-2 text-[10px] text-[#F3F1EA]/30">
                {task.completionDisclaimer}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ActiveClientRoadmapView({
  roadmap,
}: {
  roadmap: ClientSafeRoadmapPayload;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#D1A866]/65">
          Overall progress
        </p>
        <p className="mt-1 text-2xl font-light tabular-nums text-[#F3F1EA]">
          {roadmap.progressPercent}%
        </p>
      </div>

      <TaskList title="Your actions" tasks={roadmap.clientActions} />
      <TaskList title="Adviser progress" tasks={roadmap.adviserActions} />

      {roadmap.clientActions.length === 0 && roadmap.adviserActions.length === 0 ? (
        <p className="text-sm text-[#F3F1EA]/50">
          No roadmap tasks are visible yet. Your adviser will share agreed actions after
          review.
        </p>
      ) : null}
    </div>
  );
}
