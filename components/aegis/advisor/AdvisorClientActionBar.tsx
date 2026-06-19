"use client";

import Link from "next/link";

interface AdvisorClientActionBarProps {
  clientId: string;
}

const SCROLL_ACTIONS = [
  { target: "client-notes", label: "Add note" },
  { target: "client-tasks", label: "Create task" },
  { target: "client-documents", label: "Upload document" },
  { target: "client-reports", label: "View reports" },
  { target: "client-review", label: "Review status" },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function AdvisorClientActionBar({
  clientId,
}: AdvisorClientActionBarProps) {
  return (
    <section aria-label="Client file actions" className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
        Quick actions
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/advisor/clients/${clientId}/meeting-studio`}
          className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300 transition-colors hover:bg-emerald-500/18"
        >
          Start Meeting Studio
        </Link>
        {SCROLL_ACTIONS.map((action) => (
          <button
            key={action.target}
            type="button"
            onClick={() => scrollToSection(action.target)}
            className="rounded-sm border border-[#D1A866]/15 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/60 transition-colors hover:border-[#D1A866]/30 hover:text-[#F3F1EA]"
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
