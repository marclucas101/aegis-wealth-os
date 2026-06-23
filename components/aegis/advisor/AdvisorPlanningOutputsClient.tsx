"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { PublishedOutputType } from "@/lib/compliance/types";

type PublicationRow = {
  id: string;
  output_type: PublishedOutputType;
  publication_status: string;
  output_audience: string;
  published_at: string | null;
  created_at: string;
};

type PlanningCard = {
  id: string;
  label: string;
  outputTypes: PublishedOutputType[];
  createType: PublishedOutputType;
  description: string;
};

const PLANNING_CARDS: PlanningCard[] = [
  {
    id: "financial_overview",
    label: "Financial overview",
    outputTypes: ["financial_readiness_snapshot", "financial_overview"],
    createType: "financial_readiness_snapshot",
    description: "Client-safe readiness snapshot from the current dashboard analysis.",
  },
  {
    id: "my_plan",
    label: "Current planning position",
    outputTypes: ["client_plan_summary", "wealth_blueprint_summary"],
    createType: "client_plan_summary",
    description: "Summary of the client's current planning position and strategy focus.",
  },
  {
    id: "agreed_priorities",
    label: "Agreed priorities",
    outputTypes: ["goal_plan_summary", "client_plan_summary"],
    createType: "goal_plan_summary",
    description: "Goals and priorities agreed with the client.",
  },
  {
    id: "roadmap",
    label: "Wealth roadmap",
    outputTypes: ["roadmap_summary"],
    createType: "roadmap_summary",
    description: "Published roadmap actions the client can track.",
  },
  {
    id: "meeting_summary",
    label: "Meeting summary",
    outputTypes: ["meeting_summary", "annual_review_summary"],
    createType: "meeting_summary",
    description: "Normally prepared after a meeting in Meeting Studio.",
  },
];

function statusLabel(status: string, audience: string): string {
  if (status === "published" && audience === "client_published") return "Published";
  if (status === "adviser_reviewed") return "Ready for publication";
  if (status === "draft") return "Draft";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "superseded") return "Superseded";
  return status.replace(/_/g, " ");
}

interface AdvisorPlanningOutputsClientProps {
  clientId: string;
  focus?: string;
  returnTab?: string;
}

export default function AdvisorPlanningOutputsClient({
  clientId,
  focus,
  returnTab = "meeting-packs",
}: AdvisorPlanningOutputsClientProps) {
  const [outputs, setOutputs] = useState<PublicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const returnHref = `/advisor/clients/${clientId}?tab=${encodeURIComponent(returnTab)}&returnTab=${encodeURIComponent(returnTab)}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}/publications`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | { ok: true; outputs: PublicationRow[] }
          | { ok: false; error?: string; reason?: string };
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          throw new Error(!data.ok ? data.error ?? data.reason ?? "Failed to load outputs" : "Failed");
        }
        setOutputs(data.outputs);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load planning outputs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  function requestReload() {
    setReloadToken((value) => value + 1);
  }

  const cards = useMemo(() => {
    return PLANNING_CARDS.map((card) => {
      const related = outputs.filter((row) => card.outputTypes.includes(row.output_type));
      const current = related.find(
        (row) => row.publication_status === "published" && row.output_audience === "client_published",
      );
      const reviewed = related.find((row) => row.publication_status === "adviser_reviewed");
      const draft = related.find((row) => row.publication_status === "draft");
      const latest = current ?? reviewed ?? draft ?? related[0] ?? null;
      return { card, related, latest };
    });
  }, [outputs]);

  async function handleCreate(createType: PublishedOutputType, cardId: string) {
    setActiveAction(`create-${cardId}`);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/publications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputType: createType }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to create draft");
      }
      setMessage("Draft created. Review it before publishing to the client.");
      requestReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleReview(outputId: string, cardId: string) {
    setActiveAction(`review-${cardId}`);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/publications/${outputId}/review`,
        { method: "POST" },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to mark reviewed");
      }
      setMessage("Draft reviewed. You can now publish to the client vault.");
      requestReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review draft");
    } finally {
      setActiveAction(null);
    }
  }

  async function handlePublish(outputId: string, cardId: string) {
    if (
      !window.confirm(
        "Publish this planning output for client access? This replaces any current published version of the same type.",
      )
    ) {
      return;
    }
    setActiveAction(`publish-${cardId}`);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/publications/${outputId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to publish");
      }
      setMessage("Planning output published for client access.");
      requestReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#10283A]">Planning outputs</h3>
          <p className="text-sm text-[#10283A]/60">
            Create drafts from server-resolved client data, review, then explicitly publish for
            meeting packs and the client portal.
          </p>
        </div>
        <Link
          href={returnHref}
          className="rounded border border-[#10283A]/20 px-3 py-2 text-sm text-[#10283A]"
        >
          Back to meeting packs
        </Link>
      </div>

      {message ? (
        <p className="rounded-lg border border-[#107A5E]/30 bg-[#107A5E]/5 px-4 py-2 text-sm text-[#107A5E]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#10283A]/60">Loading planning outputs…</p>
      ) : (
        <ul className="grid gap-4">
          {cards.map(({ card, latest }) => {
            const highlighted = focus === card.id;
            const busy = activeAction?.endsWith(card.id) ?? false;
            const canReview = latest?.publication_status === "draft";
            const canPublish = latest?.publication_status === "adviser_reviewed";
            const isPublished =
              latest?.publication_status === "published" &&
              latest.output_audience === "client_published";

            return (
              <li
                key={card.id}
                className={`rounded-xl border bg-white p-5 ${
                  highlighted ? "border-[#107A5E]/40 ring-1 ring-[#107A5E]/20" : "border-[#10283A]/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-[#10283A]">{card.label}</h4>
                    <p className="mt-1 text-sm text-[#10283A]/60">{card.description}</p>
                    <p className="mt-2 text-xs text-[#10283A]/50">
                      Status:{" "}
                      {latest
                        ? statusLabel(latest.publication_status, latest.output_audience)
                        : "Not created"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {card.id === "meeting_summary" ? (
                      <Link
                        href={`/advisor/clients/${clientId}?tab=overview&returnTab=${encodeURIComponent(returnTab)}`}
                        className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A]"
                      >
                        Open Meeting Studio
                      </Link>
                    ) : !latest || latest.publication_status === "withdrawn" || latest.publication_status === "superseded" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleCreate(card.createType, card.id)}
                        className="rounded bg-[#107A5E] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {activeAction === `create-${card.id}` ? "Creating…" : "Create draft"}
                      </button>
                    ) : null}
                    {canReview ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReview(latest.id, card.id)}
                        className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] disabled:opacity-50"
                      >
                        {activeAction === `review-${card.id}` ? "Reviewing…" : "Mark reviewed"}
                      </button>
                    ) : null}
                    {canPublish ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePublish(latest.id, card.id)}
                        className="rounded bg-[#10283A] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {activeAction === `publish-${card.id}` ? "Publishing…" : "Publish to client"}
                      </button>
                    ) : null}
                    {isPublished ? (
                      <span className="rounded border border-[#107A5E]/30 bg-[#107A5E]/5 px-3 py-1.5 text-xs text-[#107A5E]">
                        Included in packs when selected
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
