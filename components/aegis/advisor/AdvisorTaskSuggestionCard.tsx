"use client";

import Link from "next/link";

import { PRIORITY_LABELS } from "@/components/aegis/advisor/AdvisorTaskComposer";

export type AdvisorTaskSuggestionView = {
  id: string;
  client_id: string;
  client_name: string;
  suggestion_type:
    | "complete_discover"
    | "upload_missing_document"
    | "schedule_review"
    | "address_high_risk_client"
    | "follow_up_stalled_roadmap"
    | "prepare_annual_review"
    | "review_low_shield_score"
    | "add_advisor_note";
  title: string;
  description: string;
  recommended_priority: "low" | "medium" | "high" | "urgent";
  recommended_due_date: string;
  task_type: string;
  source: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  reason: string;
};

type CardState = "idle" | "creating" | "created" | "error";

interface AdvisorTaskSuggestionCardProps {
  suggestion: AdvisorTaskSuggestionView;
  state: CardState;
  errorMessage?: string | null;
  showClient?: boolean;
  onCreate: (suggestion: AdvisorTaskSuggestionView) => void;
}

const SUGGESTION_TYPE_LABELS: Record<
  AdvisorTaskSuggestionView["suggestion_type"],
  string
> = {
  complete_discover: "Discover",
  upload_missing_document: "Document",
  schedule_review: "Review",
  address_high_risk_client: "Risk",
  follow_up_stalled_roadmap: "Roadmap",
  prepare_annual_review: "Review",
  review_low_shield_score: "Shield Score",
  add_advisor_note: "Advisor Note",
};

function formatDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priorityTone(
  priority: AdvisorTaskSuggestionView["recommended_priority"],
): string {
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

export default function AdvisorTaskSuggestionCard({
  suggestion,
  state,
  errorMessage,
  showClient = false,
  onCreate,
}: AdvisorTaskSuggestionCardProps) {
  const isCreated = state === "created";
  const isCreating = state === "creating";

  return (
    <article className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 p-4 transition-colors hover:border-[#D1A866]/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${priorityTone(suggestion.recommended_priority)}`}
            >
              {PRIORITY_LABELS[suggestion.recommended_priority]}
            </span>
            <span className="rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/75">
              {SUGGESTION_TYPE_LABELS[suggestion.suggestion_type]}
            </span>
          </div>

          <p className="mt-3 text-sm font-light text-[#F3F1EA]">
            {suggestion.title}
          </p>

          <p className="mt-2 line-clamp-3 text-sm font-light leading-relaxed text-[#F3F1EA]/60">
            {suggestion.description}
          </p>

          <p className="mt-3 text-xs font-light text-[#F3F1EA]/45">
            <span className="text-[9px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
              Reason
            </span>
            <span className="ml-2">{suggestion.reason}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
            <span>Due {formatDate(suggestion.recommended_due_date)}</span>
            {showClient ? (
              <Link
                href={`/advisor/clients/${suggestion.client_id}`}
                className="transition-colors hover:text-[#D1A866]"
              >
                {suggestion.client_name}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isCreated ? (
          <span className="rounded-sm border border-emerald-400/25 bg-emerald-400/8 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-emerald-200/80">
            Task created
          </span>
        ) : (
          <button
            type="button"
            disabled={isCreating}
            onClick={() => onCreate(suggestion)}
            className="rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866] transition hover:border-[#D1A866]/50 hover:bg-[#D1A866]/15 disabled:opacity-45"
          >
            {isCreating ? "Creating…" : "Create task"}
          </button>
        )}
      </div>

      {state === "error" && errorMessage ? (
        <p className="mt-2 text-sm font-light text-red-200/80">{errorMessage}</p>
      ) : null}
    </article>
  );
}
