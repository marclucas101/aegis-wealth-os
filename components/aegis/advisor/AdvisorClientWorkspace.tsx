"use client";

import { useCallback, useEffect, useState } from "react";

import AdvisorClientAccessDenied from "@/components/aegis/advisor/AdvisorClientAccessDenied";
import AdvisorClientActionBar from "@/components/aegis/advisor/AdvisorClientActionBar";
import AdvisorClientActivityPanel from "@/components/aegis/advisor/AdvisorClientActivityPanel";
import AdvisorClientCommandHeader from "@/components/aegis/advisor/AdvisorClientCommandHeader";
import AdvisorClientDocumentsPanel from "@/components/aegis/advisor/AdvisorClientDocumentsPanel";
import AdvisorClientFileQualityPanel from "@/components/aegis/advisor/AdvisorClientFileQualityPanel";
import AdvisorClientNotesPanel from "@/components/aegis/advisor/AdvisorClientNotesPanel";
import AdvisorClientPillarPanel from "@/components/aegis/advisor/AdvisorClientPillarPanel";
import AdvisorClientReportsPanel from "@/components/aegis/advisor/AdvisorClientReportsPanel";
import AdvisorClientReviewPanel from "@/components/aegis/advisor/AdvisorClientReviewPanel";
import AdvisorClientRiskSummary from "@/components/aegis/advisor/AdvisorClientRiskSummary";
import AdvisorClientRoadmapPanel from "@/components/aegis/advisor/AdvisorClientRoadmapPanel";
import AdvisorClientScorePanel from "@/components/aegis/advisor/AdvisorClientScorePanel";
import AdvisorClientSnapshot from "@/components/aegis/advisor/AdvisorClientSnapshot";
import AdvisorClientStressPanel from "@/components/aegis/advisor/AdvisorClientStressPanel";
import AdvisorClientTasksPanel from "@/components/aegis/advisor/AdvisorClientTasksPanel";
import AdvisorClientTimeline from "@/components/aegis/advisor/AdvisorClientTimeline";
import type { AdvisorTaskRecord } from "@/components/aegis/advisor/AdvisorTaskComposer";
import type { AdvisorClientWorkspace as WorkspaceData } from "@/lib/supabase/advisorClientQueries";
import type { ClientReviewStatusDetail } from "@/lib/supabase/advisorReviewPipeline";

type WorkspaceMode =
  | "loading"
  | "ready"
  | "forbidden"
  | "not_found"
  | "error";

interface AdvisorClientWorkspaceProps {
  clientId: string;
}

const SECTION_NAV = [
  { id: "client-file-quality", label: "File Quality" },
  { id: "client-overview", label: "Overview" },
  { id: "client-risk", label: "Risk" },
  { id: "client-roadmap", label: "Roadmap" },
  { id: "client-documents", label: "Documents" },
  { id: "client-reports", label: "Reports" },
  { id: "client-notes", label: "Notes" },
  { id: "client-tasks", label: "Tasks" },
  { id: "client-activity", label: "Activity" },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function AdvisorClientWorkspace({
  clientId,
}: AdvisorClientWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [review, setReview] = useState<ClientReviewStatusDetail | null>(null);
  const [openTaskCount, setOpenTaskCount] = useState<number | null>(null);

  const loadSupplementaryData = useCallback(async () => {
    try {
      const [reviewResponse, tasksResponse] = await Promise.all([
        fetch(`/api/advisor/clients/${clientId}/review-status`, {
          cache: "no-store",
        }),
        fetch(`/api/advisor/clients/${clientId}/tasks`, { cache: "no-store" }),
      ]);

      if (reviewResponse.ok) {
        const reviewData = (await reviewResponse.json()) as
          | { ok: true; review: ClientReviewStatusDetail }
          | { ok: false };
        if (reviewData.ok) {
          setReview(reviewData.review);
        }
      }

      if (tasksResponse.ok) {
        const tasksData = (await tasksResponse.json()) as
          | { ok: true; tasks: AdvisorTaskRecord[] }
          | { ok: false };
        if (tasksData.ok) {
          const open = tasksData.tasks.filter(
            (task) => task.status === "open" || task.status === "in_progress",
          ).length;
          setOpenTaskCount(open);
        }
      }
    } catch {
      // supplementary data is non-blocking
    }
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}`, {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 403) {
          setMode("forbidden");
          return;
        }

        if (response.status === 404) {
          setMode("not_found");
          return;
        }

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setMode("error");
          setErrorMessage(data.error ?? "Failed to load client workspace.");
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & WorkspaceData)
          | { ok: false; error?: string };

        if (!data.ok) {
          setMode("error");
          setErrorMessage(data.error ?? "Failed to load client workspace.");
          return;
        }

        setWorkspace(data);
        setMode("ready");
        void loadSupplementaryData();
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load client workspace.");
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [clientId, loadSupplementaryData]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading client file…
        </p>
      </div>
    );
  }

  if (mode === "forbidden") {
    return <AdvisorClientAccessDenied />;
  }

  if (mode === "not_found") {
    return (
      <div className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 sm:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-lg text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
            Client File
          </p>
          <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            Client not found
          </h2>
          <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
            The requested client record does not exist or is no longer
            available.
          </p>
        </div>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-6 py-12 text-center">
        <p className="text-sm font-light text-red-200/80">
          {errorMessage ?? "Unable to load client workspace."}
        </p>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  const pillarScores = workspace.shield?.pillarScores ?? null;
  const lastAnnualReview = workspace.annualReviewHistory[0] ?? null;
  const lastActivity = workspace.recentActivity[0] ?? null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdvisorClientCommandHeader
        client={workspace.client}
        adjustedShieldScore={workspace.shield?.adjustedShieldScore ?? null}
        rating={workspace.shield?.rating ?? null}
        review={review}
        lastActivity={lastActivity}
      />

      <AdvisorClientActionBar />

      <AdvisorClientFileQualityPanel clientId={clientId} />

      <nav
        aria-label="Client file sections"
        className="sticky top-14 z-20 -mx-1 flex flex-wrap gap-1 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/90 px-2 py-2 backdrop-blur-md sm:top-16"
      >
        {SECTION_NAV.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className="rounded-sm px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/45 transition-colors hover:bg-[#D1A866]/8 hover:text-[#D1A866]"
          >
            {section.label}
          </button>
        ))}
      </nav>

      <AdvisorClientSnapshot
        discover={workspace.discover}
        shield={workspace.shield}
        roadmapCompletionPercent={workspace.roadmapCompletionPercent}
        documentCount={workspace.documents.length}
        openTaskCount={openTaskCount}
        lastAnnualReview={lastAnnualReview}
      />

      <AdvisorClientTimeline
        client={workspace.client}
        recentActivity={workspace.recentActivity}
        lastAnnualReview={lastAnnualReview}
      />

      <AdvisorClientScorePanel
        client={workspace.client}
        discover={workspace.discover}
        profile={workspace.profile}
        shield={workspace.shield}
        awri={workspace.awri}
        benchmark={workspace.benchmark}
      />

      <section id="client-risk" className="scroll-mt-24 space-y-6">
        <AdvisorClientRiskSummary
          pillarScores={pillarScores}
          weakestPillar={workspace.insights?.weakestPillar ?? null}
          topStressExposures={workspace.topStressExposures}
          review={review}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <AdvisorClientPillarPanel
            pillarScores={pillarScores}
            weakestPillar={workspace.insights?.weakestPillar ?? null}
            strongestPillar={workspace.insights?.strongestPillar ?? null}
          />
          <AdvisorClientStressPanel
            topStressExposures={workspace.topStressExposures}
            stressHistory={workspace.stressHistory}
          />
        </div>

        <div id="client-review" className="scroll-mt-24">
          <AdvisorClientReviewPanel
            clientId={clientId}
            onStatusUpdated={(newStatus) => {
              setWorkspace((current) =>
                current
                  ? {
                      ...current,
                      client: { ...current.client, status: newStatus },
                    }
                  : current,
              );
              void loadSupplementaryData();
            }}
          />
        </div>
      </section>

      <div id="client-roadmap" className="scroll-mt-24">
        <AdvisorClientRoadmapPanel
          roadmap={workspace.roadmap}
          completionPercent={workspace.roadmapCompletionPercent}
        />
      </div>

      <div id="client-documents" className="scroll-mt-24">
        <AdvisorClientDocumentsPanel
          clientId={clientId}
          documents={workspace.documents}
        />
      </div>

      <div id="client-reports" className="scroll-mt-24">
        <AdvisorClientReportsPanel
          clientId={clientId}
          wealthBlueprintHistory={workspace.wealthBlueprintHistory}
          annualReviewHistory={workspace.annualReviewHistory}
        />
      </div>

      <div id="client-notes" className="scroll-mt-24">
        <AdvisorClientNotesPanel clientId={clientId} />
      </div>

      <div id="client-tasks" className="scroll-mt-24">
        <AdvisorClientTasksPanel clientId={clientId} />
      </div>

      <div id="client-activity" className="scroll-mt-24">
        <AdvisorClientActivityPanel activity={workspace.recentActivity} />
      </div>
    </div>
  );
}
