"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdvisorClientCommandCenterResponse } from "@/app/api/advisor/clients/[clientId]/command-center/route";
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
import AdvisorClientTaskSuggestionsPanel from "@/components/aegis/advisor/AdvisorClientTaskSuggestionsPanel";
import AdvisorClientTasksPanel from "@/components/aegis/advisor/AdvisorClientTasksPanel";
import AdvisorClientTimeline from "@/components/aegis/advisor/AdvisorClientTimeline";
import type { AdvisorClientCommandCenterPayload } from "@/lib/supabase/advisorClientCommandCenter";
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
  { id: "client-suggested-followups", label: "Follow-Ups" },
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

function extractCommandCenterData(
  data: Extract<AdvisorClientCommandCenterResponse, { ok: true }>,
): AdvisorClientCommandCenterPayload {
  return data as AdvisorClientCommandCenterPayload;
}

export default function AdvisorClientWorkspace({
  clientId,
}: AdvisorClientWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [commandCenter, setCommandCenter] =
    useState<AdvisorClientCommandCenterPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openTaskCountOverride, setOpenTaskCountOverride] = useState<
    number | null
  >(null);

  const loadCommandCenter = useCallback(async () => {
    const response = await fetch(
      `/api/advisor/clients/${clientId}/command-center`,
      { cache: "no-store" },
    );

    if (response.status === 403) {
      return { kind: "forbidden" as const };
    }

    if (response.status === 404) {
      return { kind: "not_found" as const };
    }

    const data = (await response.json()) as AdvisorClientCommandCenterResponse;

    if (!response.ok || !data.ok) {
      return {
        kind: "error" as const,
        message:
          data.ok === false && data.error
            ? data.error
            : "Failed to load client workspace.",
      };
    }

    return {
      kind: "success" as const,
      data: extractCommandCenterData(data),
    };
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const result = await loadCommandCenter();
        if (cancelled) return;

        if (result.kind === "forbidden") {
          setMode("forbidden");
          return;
        }

        if (result.kind === "not_found") {
          setMode("not_found");
          return;
        }

        if (result.kind === "error") {
          setMode("error");
          setErrorMessage(result.message);
          return;
        }

        setCommandCenter(result.data);
        setOpenTaskCountOverride(null);
        setMode("ready");
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load client workspace.");
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [loadCommandCenter]);

  const refreshCommandCenter = useCallback(async () => {
    setRefreshing(true);

    try {
      const result = await loadCommandCenter();
      if (result.kind === "success") {
        setCommandCenter(result.data);
        setOpenTaskCountOverride(null);
      }
    } catch {
      // keep existing data on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [loadCommandCenter]);

  const openTaskCount = useMemo(() => {
    if (openTaskCountOverride !== null) return openTaskCountOverride;
    if (!commandCenter || commandCenter.tasksError) return null;
    return commandCenter.tasks.filter(
      (task) => task.status === "open" || task.status === "in_progress",
    ).length;
  }, [commandCenter, openTaskCountOverride]);

  const handleReviewUpdated = useCallback((newStatus: string) => {
    setCommandCenter((current) =>
      current
        ? {
            ...current,
            client: {
              ...current.client,
              status: newStatus as typeof current.client.status,
            },
          }
        : current,
    );
  }, []);

  const handleReviewRefreshed = useCallback((review: ClientReviewStatusDetail) => {
    setCommandCenter((current) =>
      current ? { ...current, review } : current,
    );
  }, []);

  const handleOpenTaskCountChange = useCallback((count: number) => {
    setOpenTaskCountOverride(count);
  }, []);

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
        <button
          type="button"
          onClick={() => void refreshCommandCenter()}
          className="mt-4 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!commandCenter) {
    return null;
  }

  const pillarScores = commandCenter.shield?.pillarScores ?? null;
  const lastAnnualReview = commandCenter.annualReviewHistory[0] ?? null;
  const lastActivity = commandCenter.recentActivity[0] ?? null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {refreshing ? (
        <p className="text-center text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/30">
          Refreshing client file…
        </p>
      ) : null}

      <AdvisorClientCommandHeader
        client={commandCenter.client}
        adjustedShieldScore={commandCenter.shield?.adjustedShieldScore ?? null}
        rating={commandCenter.shield?.rating ?? null}
        review={commandCenter.review}
        lastActivity={lastActivity}
      />

      <AdvisorClientActionBar />

      <AdvisorClientFileQualityPanel
        quality={commandCenter.fileQuality}
        error={commandCenter.fileQualityError}
        onRetry={() => void refreshCommandCenter()}
      />

      <AdvisorClientTaskSuggestionsPanel
        initialPayload={commandCenter.taskSuggestions}
        error={commandCenter.suggestionsError}
        onRetry={() => void refreshCommandCenter()}
      />

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

      <div id="client-overview" className="scroll-mt-24 space-y-6">
        <AdvisorClientSnapshot
          discover={commandCenter.discover}
          shield={commandCenter.shield}
          roadmapCompletionPercent={commandCenter.roadmapCompletionPercent}
          documentCount={commandCenter.documents.length}
          openTaskCount={openTaskCount}
          lastAnnualReview={lastAnnualReview}
        />

        <AdvisorClientTimeline
          client={commandCenter.client}
          recentActivity={commandCenter.recentActivity}
          lastAnnualReview={lastAnnualReview}
        />

        <AdvisorClientScorePanel
          client={commandCenter.client}
          discover={commandCenter.discover}
          profile={commandCenter.profile}
          shield={commandCenter.shield}
          awri={commandCenter.awri}
          benchmark={commandCenter.benchmark}
        />
      </div>

      <section id="client-risk" className="scroll-mt-24 space-y-6">
        <AdvisorClientRiskSummary
          pillarScores={pillarScores}
          weakestPillar={commandCenter.insights?.weakestPillar ?? null}
          topStressExposures={commandCenter.topStressExposures}
          review={commandCenter.review}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <AdvisorClientPillarPanel
            pillarScores={pillarScores}
            weakestPillar={commandCenter.insights?.weakestPillar ?? null}
            strongestPillar={commandCenter.insights?.strongestPillar ?? null}
          />
          <AdvisorClientStressPanel
            topStressExposures={commandCenter.topStressExposures}
            stressHistory={commandCenter.stressHistory}
          />
        </div>

        <div id="client-review" className="scroll-mt-24">
          <AdvisorClientReviewPanel
            clientId={clientId}
            review={commandCenter.review}
            error={commandCenter.reviewError}
            onRetry={() => void refreshCommandCenter()}
            onStatusUpdated={handleReviewUpdated}
            onReviewRefreshed={handleReviewRefreshed}
          />
        </div>
      </section>

      <div id="client-roadmap" className="scroll-mt-24">
        <AdvisorClientRoadmapPanel
          roadmap={commandCenter.roadmap}
          completionPercent={commandCenter.roadmapCompletionPercent}
        />
      </div>

      <div id="client-documents" className="scroll-mt-24">
        <AdvisorClientDocumentsPanel
          clientId={clientId}
          documents={commandCenter.documents}
          loadError={commandCenter.documentsError}
          onRetry={() => void refreshCommandCenter()}
        />
      </div>

      <div id="client-reports" className="scroll-mt-24">
        <AdvisorClientReportsPanel
          clientId={clientId}
          wealthBlueprintHistory={commandCenter.wealthBlueprintHistory}
          annualReviewHistory={commandCenter.annualReviewHistory}
          metadataError={commandCenter.reportsError}
          onRetry={() => void refreshCommandCenter()}
        />
      </div>

      <div id="client-notes" className="scroll-mt-24">
        <AdvisorClientNotesPanel
          clientId={clientId}
          initialNotes={commandCenter.notes}
          error={commandCenter.notesError}
          viewer={commandCenter.viewer}
          onRetry={() => void refreshCommandCenter()}
        />
      </div>

      <div id="client-tasks" className="scroll-mt-24">
        <AdvisorClientTasksPanel
          clientId={clientId}
          initialTasks={commandCenter.tasks}
          error={commandCenter.tasksError}
          viewer={commandCenter.viewer}
          onRetry={() => void refreshCommandCenter()}
          onOpenTaskCountChange={handleOpenTaskCountChange}
        />
      </div>

      <div id="client-activity" className="scroll-mt-24">
        <AdvisorClientActivityPanel
          activity={
            commandCenter.activityError ? null : commandCenter.recentActivity
          }
          error={commandCenter.activityError}
          onRetry={() => void refreshCommandCenter()}
        />
      </div>
    </div>
  );
}
