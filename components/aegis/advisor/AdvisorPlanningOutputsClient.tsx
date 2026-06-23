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
  prerequisiteTab?: string;
  prerequisiteLabel?: string;
};

type CardPhase = "published" | "ready" | "draft" | "not_created" | "replaceable";

type ApiErrorBody = {
  code?: string | null;
  message?: string;
};

type CardFeedback = {
  message: string;
  code: string | null;
  tone: "error" | "success";
};

const PLANNING_CARDS: PlanningCard[] = [
  {
    id: "financial_overview",
    label: "Financial overview",
    outputTypes: ["financial_readiness_snapshot", "financial_overview"],
    createType: "financial_readiness_snapshot",
    description: "Client-safe readiness snapshot from the current dashboard analysis.",
    prerequisiteTab: "dashboard",
    prerequisiteLabel: "Open dashboard",
  },
  {
    id: "my_plan",
    label: "Current planning position",
    outputTypes: ["client_plan_summary", "wealth_blueprint_summary"],
    createType: "client_plan_summary",
    description: "Summary of the client's current planning position and strategy focus.",
    prerequisiteTab: "dashboard",
    prerequisiteLabel: "Complete financial profile",
  },
  {
    id: "agreed_priorities",
    label: "Agreed priorities",
    outputTypes: ["goal_plan_summary", "client_plan_summary"],
    createType: "goal_plan_summary",
    description: "Goals and priorities agreed with the client.",
    prerequisiteTab: "financial-profile",
    prerequisiteLabel: "Open financial profile",
  },
  {
    id: "roadmap",
    label: "Wealth roadmap",
    outputTypes: ["roadmap_summary"],
    createType: "roadmap_summary",
    description: "Published roadmap actions the client can track.",
    prerequisiteLabel: "Add roadmap actions",
  },
  {
    id: "meeting_summary",
    label: "Meeting summary",
    outputTypes: ["meeting_summary", "annual_review_summary"],
    createType: "meeting_summary",
    description: "Normally prepared after a meeting in Meeting Studio.",
    prerequisiteTab: "overview",
    prerequisiteLabel: "Open Meeting Studio",
  },
];

function statusLabel(phase: CardPhase): string {
  switch (phase) {
    case "published":
      return "Published";
    case "ready":
      return "Ready for publication";
    case "draft":
      return "Draft";
    case "replaceable":
      return "Not current";
    default:
      return "Not created";
  }
}

function resolveCardPhase(latest: PublicationRow | null): CardPhase {
  if (!latest) return "not_created";
  if (
    latest.publication_status === "published" &&
    latest.output_audience === "client_published"
  ) {
    return "published";
  }
  if (latest.publication_status === "adviser_reviewed") return "ready";
  if (latest.publication_status === "draft") return "draft";
  if (
    latest.publication_status === "withdrawn" ||
    latest.publication_status === "superseded"
  ) {
    return "replaceable";
  }
  return "not_created";
}

async function parseApiJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractApiError(data: { ok?: boolean; error?: string | ApiErrorBody } | null): ApiErrorBody {
  if (!data || data.ok !== false) {
    return { message: "The output could not be prepared. Please try again.", code: "PLANNING_OUTPUT_PREPARATION_FAILED" };
  }
  if (typeof data.error === "object" && data.error !== null) {
    return {
      message: data.error.message ?? "The output could not be prepared. Please try again.",
      code: data.error.code ?? null,
    };
  }
  if (typeof data.error === "string") {
    return { message: data.error, code: null };
  }
  return { message: "The output could not be prepared. Please try again.", code: null };
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
  const [pageError, setPageError] = useState<string | null>(null);
  const [cardFeedback, setCardFeedback] = useState<Record<string, CardFeedback>>({});
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [clientVisibleRoadmapCount, setClientVisibleRoadmapCount] = useState<number | null>(null);

  const returnHref = `/advisor/clients/${clientId}?tab=${encodeURIComponent(returnTab)}&returnTab=${encodeURIComponent(returnTab)}`;
  const roadmapEditorHref = `/advisor/clients/${clientId}/roadmap?returnTab=planning-outputs`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setPageError(null);
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}/publications`, {
          cache: "no-store",
        });
        const data = await parseApiJson<
          | { ok: true; outputs: PublicationRow[] }
          | { ok: false; error?: string | ApiErrorBody; reason?: string }
        >(response);
        if (cancelled) return;
        if (!response.ok || !data?.ok) {
          const apiError = extractApiError(data);
          throw new Error(apiError.message);
        }
        setOutputs(data.outputs);
      } catch (err) {
        if (cancelled) return;
        setPageError(err instanceof Error ? err.message : "Unable to load planning outputs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadRoadmapPrerequisite() {
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}/roadmap-actions`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          ok: boolean;
          clientVisibleCount?: number;
        };
        if (cancelled || !response.ok || !data.ok) return;
        setClientVisibleRoadmapCount(data.clientVisibleCount ?? 0);
      } catch {
        if (!cancelled) setClientVisibleRoadmapCount(0);
      }
    }
    void loadRoadmapPrerequisite();
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadToken]);

  function requestReload() {
    setReloadToken((value) => value + 1);
  }

  function clearCardFeedback(cardId: string) {
    setCardFeedback((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
  }

  function setCardSuccess(cardId: string, message: string) {
    setCardFeedback((current) => ({
      ...current,
      [cardId]: { message, code: null, tone: "success" },
    }));
  }

  function setCardFailure(cardId: string, error: ApiErrorBody) {
    setCardFeedback((current) => ({
      ...current,
      [cardId]: {
        message: error.message ?? "The output could not be prepared. Please try again.",
        code: error.code ?? null,
        tone: "error",
      },
    }));
  }

  const cards = useMemo(() => {
    return PLANNING_CARDS.map((card) => {
      const related = outputs.filter((row) => card.outputTypes.includes(row.output_type));
      const forCreateType = related.filter((row) => row.output_type === card.createType);
      const pickLatest = (rows: PublicationRow[]) => {
        const current = rows.find(
          (row) =>
            row.publication_status === "published" &&
            row.output_audience === "client_published",
        );
        const reviewed = rows.find((row) => row.publication_status === "adviser_reviewed");
        const draft = rows.find((row) => row.publication_status === "draft");
        return current ?? reviewed ?? draft ?? rows[0] ?? null;
      };
      const latest = pickLatest(related);
      const latestForCreateType = pickLatest(forCreateType);
      const phase = resolveCardPhase(latest);
      const createBlocked = phase === "published" || phase === "ready" || phase === "draft";
      return { card, latest, latestForCreateType, phase, createBlocked };
    });
  }, [outputs]);

  async function handleCreate(createType: PublishedOutputType, cardId: string) {
    setActiveAction(`create-${cardId}`);
    clearCardFeedback(cardId);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/publications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputType: createType }),
      });
      const data = await parseApiJson<{ ok: boolean; error?: string | ApiErrorBody }>(response);
      if (!response.ok || !data?.ok) {
        setCardFailure(cardId, extractApiError(data));
        return;
      }
      setCardSuccess(cardId, "Draft created. Review it before publishing to the client.");
      requestReload();
    } catch {
      setCardFailure(cardId, {
        message: "The output could not be prepared. Please try again.",
        code: "PLANNING_OUTPUT_PREPARATION_FAILED",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleReview(outputId: string, cardId: string) {
    setActiveAction(`review-${cardId}`);
    clearCardFeedback(cardId);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/publications/${outputId}/review`,
        { method: "POST" },
      );
      const data = await parseApiJson<{ ok: boolean; error?: string | ApiErrorBody }>(response);
      if (!response.ok || !data?.ok) {
        setCardFailure(cardId, extractApiError(data));
        return;
      }
      setCardSuccess(cardId, "Draft reviewed. You can now publish to the client vault.");
      requestReload();
    } catch {
      setCardFailure(cardId, {
        message: "The output could not be reviewed. Please try again.",
        code: "PLANNING_OUTPUT_NOT_REVIEWABLE",
      });
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
    clearCardFeedback(cardId);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/publications/${outputId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const data = await parseApiJson<{ ok: boolean; error?: string | ApiErrorBody }>(response);
      if (!response.ok || !data?.ok) {
        setCardFailure(cardId, extractApiError(data));
        return;
      }
      setCardSuccess(cardId, "Planning output published for client access.");
      requestReload();
    } catch {
      setCardFailure(cardId, {
        message: "The output could not be published. Please try again.",
        code: "PLANNING_OUTPUT_PUBLISH_FAILED",
      });
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold tracking-wide text-[#F3F1EA] sm:text-2xl">
            Planning outputs
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#F3F1EA]/70">
            Create drafts from server-resolved client data, review, then explicitly publish for
            meeting packs and the client portal.
          </p>
        </div>
        <Link
          href={returnHref}
          className="inline-flex shrink-0 items-center justify-center rounded border border-[#D1A866]/35 px-4 py-2 text-sm font-medium text-[#F3F1EA]/90 transition hover:border-[#107A5E]/50 hover:text-[#107A5E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#107A5E]"
        >
          Back to meeting packs
        </Link>
      </div>

      {pageError ? (
        <div className="rounded-lg border border-red-400/30 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          <p>{pageError}</p>
          <button
            type="button"
            onClick={() => requestReload()}
            className="mt-3 rounded border border-red-300/40 px-3 py-1.5 text-xs text-red-100 hover:bg-red-900/30"
          >
            Retry loading
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#F3F1EA]/60">Loading planning outputs…</p>
      ) : (
        <ul className="grid gap-4">
          {cards.map(({ card, latest, phase, createBlocked }) => {
            const highlighted = focus === card.id;
            const busy = activeAction?.endsWith(card.id) ?? false;
            const feedback = cardFeedback[card.id];
            const prerequisiteHref = card.prerequisiteTab
              ? `/advisor/clients/${clientId}?tab=${encodeURIComponent(card.prerequisiteTab)}&returnTab=${encodeURIComponent(returnTab)}`
              : card.id === "roadmap"
                ? roadmapEditorHref
                : null;
            const hasRoadmapSource =
              card.id !== "roadmap" || (clientVisibleRoadmapCount ?? 0) > 0;
            const showRoadmapPrerequisite =
              card.id === "roadmap" &&
              !hasRoadmapSource &&
              (phase === "not_created" || phase === "replaceable");

            return (
              <li
                key={card.id}
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  highlighted ? "border-[#107A5E]/40 ring-1 ring-[#107A5E]/20" : "border-[#10283A]/10"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-[#10283A]">{card.label}</h4>
                    <p className="mt-1 text-sm text-[#10283A]/70">{card.description}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[#10283A]/55">
                      Status: {statusLabel(phase)}
                    </p>
                    {showRoadmapPrerequisite ? (
                      <p className="mt-2 text-sm text-[#10283A]/70">
                        No roadmap actions have been created for this client.
                      </p>
                    ) : null}
                    {feedback ? (
                      <div
                        className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                          feedback.tone === "success"
                            ? "border border-[#107A5E]/25 bg-[#107A5E]/5 text-[#107A5E]"
                            : "border border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        <p>{feedback.message}</p>
                        {feedback.code ? (
                          <p className="mt-1 text-xs opacity-70">Reference: {feedback.code}</p>
                        ) : null}
                        {feedback.tone === "error" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (phase === "draft" && latest) {
                                void handleReview(latest.id, card.id);
                              } else if (phase === "ready" && latest) {
                                void handlePublish(latest.id, card.id);
                              } else if (!createBlocked && card.id !== "meeting_summary") {
                                void handleCreate(card.createType, card.id);
                              }
                            }}
                            className="mt-2 rounded border border-current/30 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            Retry
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {card.id === "meeting_summary" ? (
                      <Link
                        href={prerequisiteHref ?? returnHref}
                        className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] hover:bg-[#10283A]/5"
                      >
                        {card.prerequisiteLabel ?? "Open Meeting Studio"}
                      </Link>
                    ) : null}

                    {phase === "published" ? (
                      <span className="rounded border border-[#107A5E]/30 bg-[#107A5E]/5 px-3 py-1.5 text-xs font-medium text-[#107A5E]">
                        Published · included in packs when selected
                      </span>
                    ) : null}

                    {phase === "ready" && latest ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handlePublish(latest.id, card.id)}
                        className="rounded bg-[#10283A] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {activeAction === `publish-${card.id}` ? "Publishing…" : "Publish to client"}
                      </button>
                    ) : null}

                    {phase === "draft" && latest ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReview(latest.id, card.id)}
                        className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] disabled:opacity-50"
                      >
                        {activeAction === `review-${card.id}` ? "Reviewing…" : "Review draft"}
                      </button>
                    ) : null}

                    {!createBlocked && card.id !== "meeting_summary" && hasRoadmapSource ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleCreate(card.createType, card.id)}
                        className="rounded bg-[#107A5E] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {activeAction === `create-${card.id}`
                          ? "Creating…"
                          : card.id === "roadmap"
                            ? "Create wealth-roadmap draft"
                            : "Create draft"}
                      </button>
                    ) : null}

                    {showRoadmapPrerequisite && prerequisiteHref ? (
                      <Link
                        href={prerequisiteHref}
                        className="rounded bg-[#107A5E] px-3 py-1.5 text-xs text-white hover:bg-[#107A5E]/90"
                      >
                        {card.prerequisiteLabel ?? "Add roadmap actions"}
                      </Link>
                    ) : null}

                    {(phase === "not_created" || phase === "replaceable") &&
                    card.id !== "meeting_summary" &&
                    card.id !== "roadmap" &&
                    prerequisiteHref &&
                    card.prerequisiteLabel ? (
                      <Link
                        href={prerequisiteHref}
                        className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] hover:bg-[#10283A]/5"
                      >
                        {card.prerequisiteLabel}
                      </Link>
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
