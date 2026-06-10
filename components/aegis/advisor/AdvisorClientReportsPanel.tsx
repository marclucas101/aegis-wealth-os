"use client";

import { useCallback, useState } from "react";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import AdvisorReportModal from "@/components/aegis/advisor/AdvisorReportModal";
import {
  AdvisorAnnualReviewViewer,
  AdvisorWealthBlueprintViewer,
} from "@/components/aegis/advisor/AdvisorReportViewer";
import type {
  AdvisorAnnualReviewEntry,
  AdvisorWealthBlueprintEntry,
} from "@/lib/supabase/advisorClientQueries";
import type {
  AdvisorAnnualReviewDetail,
  AdvisorWealthBlueprintDetail,
} from "@/lib/supabase/advisorReportQueries";

interface AdvisorClientReportsPanelProps {
  clientId: string;
  wealthBlueprintHistory: AdvisorWealthBlueprintEntry[];
  annualReviewHistory: AdvisorAnnualReviewEntry[];
}

type ReportViewState =
  | { kind: "idle" }
  | { kind: "loading"; type: "blueprint" | "annual"; id: string; title: string }
  | {
      kind: "blueprint";
      report: AdvisorWealthBlueprintDetail;
    }
  | {
      kind: "annual";
      report: AdvisorAnnualReviewDetail;
    }
  | { kind: "error"; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvisorClientReportsPanel({
  clientId,
  wealthBlueprintHistory,
  annualReviewHistory,
}: AdvisorClientReportsPanelProps) {
  const [viewState, setViewState] = useState<ReportViewState>({ kind: "idle" });
  const [listError, setListError] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setViewState({ kind: "idle" });
  }, []);

  async function handleViewBlueprint(entry: AdvisorWealthBlueprintEntry) {
    setListError(null);
    setViewState({
      kind: "loading",
      type: "blueprint",
      id: entry.id,
      title: entry.title,
    });

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/reports/wealth-blueprints/${entry.id}`,
        { cache: "no-store" },
      );

      const data = (await response.json()) as
        | { ok: true; report: AdvisorWealthBlueprintDetail }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setViewState({ kind: "idle" });
        setListError(data.ok ? "Unable to load report." : (data.error ?? "Unable to load report."));
        return;
      }

      setViewState({ kind: "blueprint", report: data.report });
    } catch {
      setViewState({ kind: "idle" });
      setListError("Unable to load report.");
    }
  }

  async function handleViewAnnualReview(entry: AdvisorAnnualReviewEntry) {
    setListError(null);
    const title = entry.reviewLabel ?? `${entry.reviewYear} Annual Review`;
    setViewState({
      kind: "loading",
      type: "annual",
      id: entry.id,
      title,
    });

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/reports/annual-reviews/${entry.id}`,
        { cache: "no-store" },
      );

      const data = (await response.json()) as
        | { ok: true; report: AdvisorAnnualReviewDetail }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setViewState({ kind: "idle" });
        setListError(data.ok ? "Unable to load report." : (data.error ?? "Unable to load report."));
        return;
      }

      setViewState({ kind: "annual", report: data.report });
    } catch {
      setViewState({ kind: "idle" });
      setListError("Unable to load report.");
    }
  }

  const modalOpen =
    viewState.kind === "loading" ||
    viewState.kind === "blueprint" ||
    viewState.kind === "annual";

  return (
    <>
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
        <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Reports
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Wealth Blueprint and Annual Review snapshots
          </p>
        </div>

        {listError ? (
          <div className="relative border-b border-red-400/15 bg-red-400/5 px-5 py-3">
            <p className="text-xs font-light text-red-200/80">{listError}</p>
          </div>
        ) : null}

        <div className="relative grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-[#D1A866]/8">
          <div>
            <p className="border-b border-[#D1A866]/8 px-5 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
              Wealth Blueprint
            </p>
            {wealthBlueprintHistory.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-light text-[#F3F1EA]/50">
                  No blueprint reports saved.
                </p>
                <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
                  Wealth Architecture Blueprints appear after client generation.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#D1A866]/8">
                {wealthBlueprintHistory.map((entry) => {
                  const isLoading =
                    viewState.kind === "loading" &&
                    viewState.type === "blueprint" &&
                    viewState.id === entry.id;

                  return (
                    <li key={entry.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-light text-[#F3F1EA]">
                            {entry.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-mono tabular-nums text-[#D1A866]">
                              {entry.adjustedShieldScore != null
                                ? formatScore(entry.adjustedShieldScore)
                                : "—"}{" "}
                              {entry.rating ? `· ${entry.rating}` : ""}
                            </span>
                            {entry.awri != null && (
                              <span className="font-mono text-[#F3F1EA]/50">
                                AWRI {formatScore(entry.awri)}
                              </span>
                            )}
                            <span className="text-[#F3F1EA]/35">
                              {formatDate(entry.generatedAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleViewBlueprint(entry)}
                          disabled={isLoading}
                          className="shrink-0 rounded-sm border border-[#D1A866]/25 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866] transition hover:border-[#D1A866]/40 hover:bg-[#D1A866]/15 disabled:opacity-45"
                        >
                          {isLoading ? "Loading…" : "View"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <p className="border-b border-[#D1A866]/8 px-5 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
              Annual Review
            </p>
            {annualReviewHistory.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-light text-[#F3F1EA]/50">
                  No annual reviews saved.
                </p>
                <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
                  Annual review snapshots are saved from the client review flow.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#D1A866]/8">
                {annualReviewHistory.map((entry) => {
                  const isLoading =
                    viewState.kind === "loading" &&
                    viewState.type === "annual" &&
                    viewState.id === entry.id;

                  return (
                    <li key={entry.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-light text-[#F3F1EA]">
                            {entry.reviewLabel ?? `${entry.reviewYear} Annual Review`}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-mono tabular-nums text-[#D1A866]">
                              {formatScore(entry.adjustedShieldScore)} · {entry.rating}
                            </span>
                            <span className="text-[#F3F1EA]/35">
                              {formatDate(entry.generatedAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleViewAnnualReview(entry)}
                          disabled={isLoading}
                          className="shrink-0 rounded-sm border border-[#D1A866]/25 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866] transition hover:border-[#D1A866]/40 hover:bg-[#D1A866]/15 disabled:opacity-45"
                        >
                          {isLoading ? "Loading…" : "View"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {modalOpen ? (
        <AdvisorReportModal
          title={
            viewState.kind === "loading"
              ? viewState.title
              : viewState.kind === "blueprint"
                ? viewState.report.title
                : viewState.kind === "annual"
                  ? (viewState.report.reviewLabel ??
                    `${viewState.report.reviewYear} Annual Review`)
                  : ""
          }
          subtitle={
            viewState.kind === "blueprint"
              ? `Generated ${formatDate(viewState.report.generatedAt)}`
              : viewState.kind === "annual"
                ? `Generated ${formatDate(viewState.report.generatedAt)}`
                : undefined
          }
          onClose={closeModal}
        >
          {viewState.kind === "loading" ? (
            <p className="py-8 text-center text-sm font-light text-[#F3F1EA]/45">
              Loading report snapshot…
            </p>
          ) : viewState.kind === "blueprint" ? (
            <AdvisorWealthBlueprintViewer report={viewState.report} />
          ) : viewState.kind === "annual" ? (
            <AdvisorAnnualReviewViewer report={viewState.report} />
          ) : null}
        </AdvisorReportModal>
      ) : null}
    </>
  );
}
