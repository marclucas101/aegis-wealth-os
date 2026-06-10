"use client";

const ACTIONS = [
  {
    id: "advisor-onboarding",
    label: "Add prospective client",
    description: "Create placeholder and invite",
  },
  {
    id: "advisor-tasks",
    label: "Create task",
    description: "Follow-up or review action",
  },
  {
    id: "advisor-review-pipeline",
    label: "Review pipeline",
    description: "Due, overdue, and priority",
  },
  {
    id: "advisor-clients",
    label: "Client registry",
    description: "Search and open workspaces",
  },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function AdvisorQuickActions() {
  return (
    <section aria-label="Quick actions" className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
        Quick actions
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => scrollToSection(action.id)}
            className="group rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50 px-4 py-3 text-left transition-colors hover:border-[#D1A866]/28 hover:bg-[#10283A]/75"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/85 transition-colors group-hover:text-[#D1A866]">
              {action.label}
            </p>
            <p className="mt-1 text-xs font-light text-[#F3F1EA]/40">
              {action.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
