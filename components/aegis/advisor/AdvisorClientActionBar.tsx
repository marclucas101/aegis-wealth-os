"use client";

const ACTIONS = [
  {
    target: "client-notes",
    label: "Add note",
    primary: false,
  },
  {
    target: "client-tasks",
    label: "Create task",
    primary: false,
  },
  {
    target: "client-documents",
    label: "Upload document",
    primary: false,
  },
  {
    target: "client-reports",
    label: "View reports",
    primary: false,
  },
  {
    target: "client-review",
    label: "Review status",
    primary: true,
  },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function AdvisorClientActionBar() {
  return (
    <section aria-label="Client file actions" className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
        Quick actions
      </p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.target}
            type="button"
            onClick={() => scrollToSection(action.target)}
            className={
              action.primary
                ? "rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/18"
                : "rounded-sm border border-[#D1A866]/15 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/60 transition-colors hover:border-[#D1A866]/30 hover:text-[#F3F1EA]"
            }
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
