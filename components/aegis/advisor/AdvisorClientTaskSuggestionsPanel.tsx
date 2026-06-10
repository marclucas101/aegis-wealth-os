"use client";

import { useCallback, useEffect, useState } from "react";

import AdvisorTaskSuggestionCard, {
  type AdvisorTaskSuggestionView,
} from "@/components/aegis/advisor/AdvisorTaskSuggestionCard";

type PanelMode = "loading" | "ready" | "error";

type CardState = "idle" | "creating" | "created" | "error";

type SuggestionsPayload = {
  suggestions: AdvisorTaskSuggestionView[];
  summary: {
    totalCount: number;
    urgentCount: number;
    highCount: number;
    clientCount: number;
  };
};

interface AdvisorClientTaskSuggestionsPanelProps {
  clientId: string;
}

export default function AdvisorClientTaskSuggestionsPanel({
  clientId,
}: AdvisorClientTaskSuggestionsPanelProps) {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [payload, setPayload] = useState<SuggestionsPayload | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const loadSuggestions = useCallback(async () => {
    setMode("loading");

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/task-suggestions`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as
        | ({ ok: true } & SuggestionsPayload)
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setMode("error");
        return;
      }

      setPayload(data);
      setMode("ready");
    } catch {
      setMode("error");
    }
  }, [clientId]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  async function handleCreate(suggestion: AdvisorTaskSuggestionView) {
    setCardStates((current) => ({
      ...current,
      [suggestion.id]: "creating",
    }));
    setCardErrors((current) => {
      const next = { ...current };
      delete next[suggestion.id];
      return next;
    });

    try {
      const response = await fetch("/api/advisor/task-suggestions/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          client_id: suggestion.client_id,
        }),
      });

      const data = (await response.json()) as
        | { ok: true }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setCardStates((current) => ({
          ...current,
          [suggestion.id]: "error",
        }));
        setCardErrors((current) => ({
          ...current,
          [suggestion.id]: data.ok
            ? "Failed to create task."
            : (data.error ?? "Failed to create task."),
        }));
        return;
      }

      setCardStates((current) => ({
        ...current,
        [suggestion.id]: "created",
      }));

      setPayload((current) => {
        if (!current) return current;
        return {
          ...current,
          suggestions: current.suggestions.filter(
            (item) => item.id !== suggestion.id,
          ),
          summary: {
            ...current.summary,
            totalCount: Math.max(0, current.summary.totalCount - 1),
            urgentCount:
              suggestion.recommended_priority === "urgent"
                ? Math.max(0, current.summary.urgentCount - 1)
                : current.summary.urgentCount,
            highCount:
              suggestion.recommended_priority === "high"
                ? Math.max(0, current.summary.highCount - 1)
                : current.summary.highCount,
          },
        };
      });
    } catch {
      setCardStates((current) => ({
        ...current,
        [suggestion.id]: "error",
      }));
      setCardErrors((current) => ({
        ...current,
        [suggestion.id]: "Failed to create task.",
      }));
    }
  }

  if (mode === "loading") {
    return (
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading suggested follow-ups…
        </p>
      </section>
    );
  }

  if (mode === "error") {
    return (
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Unable to load suggested follow-ups.
        </p>
        <button
          type="button"
          onClick={() => void loadSuggestions()}
          className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
        >
          Retry
        </button>
      </section>
    );
  }

  const suggestions = payload?.suggestions ?? [];
  const summary = payload?.summary;

  return (
    <section
      id="client-suggested-followups"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Suggested Follow-Ups
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Follow-up tasks computed from file quality gaps, review status, and
          risk signals for this client.
        </p>
        {summary && summary.totalCount > 0 ? (
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/40">
            <span>{summary.totalCount} suggestions</span>
            {summary.urgentCount > 0 ? (
              <span className="text-red-200/70">
                {summary.urgentCount} urgent
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="relative space-y-4 px-5 py-5">
        {suggestions.length === 0 ? (
          <p className="py-4 text-center text-sm font-light text-[#F3F1EA]/40">
            No follow-up suggestions for this client right now.
          </p>
        ) : (
          <div className="grid gap-4">
            {suggestions.map((suggestion) => (
              <AdvisorTaskSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                state={cardStates[suggestion.id] ?? "idle"}
                errorMessage={cardErrors[suggestion.id]}
                onCreate={handleCreate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
