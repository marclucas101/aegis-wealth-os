"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdvisorClientCommandCenterResponse } from "@/app/api/advisor/clients/[clientId]/command-center/route";
import type { AdvisorClientCommandCenterHeavyResponse } from "@/app/api/advisor/clients/[clientId]/command-center/heavy/route";
import AdvisorClientAppointmentsPanel from "@/components/aegis/advisor/AdvisorClientAppointmentsPanel";
import AdvisorClientBudgetPanel from "@/components/aegis/advisor/AdvisorClientBudgetPanel";
import AdvisorClientFeedbackPanel from "@/components/aegis/advisor/AdvisorClientFeedbackPanel";
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
import type {
  AdvisorClientCommandCenterPayload,
  AdvisorClientCommandCenterShellPayload,
} from "@/lib/supabase/advisorClientCommandCenter";
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

type WorkspaceTab =
  | "overview"
  | "financial-profile"
  | "shield-diagnostic"
  | "budget"
  | "protection-reports"
  | "document-vault"
  | "appointments"
  | "feedback"
  | "notes";

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "financial-profile", label: "Financial Profile" },
  { id: "shield-diagnostic", label: "Shield Diagnostic" },
  { id: "budget", label: "Budget" },
  { id: "protection-reports", label: "Protection Reports" },
  { id: "document-vault", label: "Document Vault" },
  { id: "appointments", label: "Appointments" },
  { id: "feedback", label: "Feedback" },
  { id: "notes", label: "Notes" },
];

function shellToCommandCenter(
  shell: AdvisorClientCommandCenterShellPayload,
): AdvisorClientCommandCenterPayload {
  return {
    ...shell,
    fileQuality: null,
    fileQualityError: null,
    taskSuggestions: null,
    suggestionsError: null,
    tasks: [],
    tasksError: null,
    notes: [],
    notesError: null,
    timing: {
      ...shell.timing,
      fileQualityMs: null,
      taskSuggestionsMs: null,
      tasksMs: null,
      notesMs: null,
    },
  };
}

function extractCommandCenterShell(
  data: Extract<AdvisorClientCommandCenterResponse, { ok: true }>,
): AdvisorClientCommandCenterShellPayload {
  return data as AdvisorClientCommandCenterShellPayload;
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

  const loadShell = useCallback(async () => {
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
      data: shellToCommandCenter(extractCommandCenterShell(data)),
    };
  }, [clientId]);

  const loadHeavy = useCallback(async () => {
    const response = await fetch(
      `/api/advisor/clients/${clientId}/command-center/heavy`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return { kind: "error" as const };
    }

    const data =
      (await response.json()) as AdvisorClientCommandCenterHeavyResponse;

    if (!data.ok) {
      return { kind: "error" as const };
    }

    return { kind: "success" as const, data };
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const result = await loadShell();
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
  }, [loadShell]);

  useEffect(() => {
    if (mode !== "ready") return;

    let cancelled = false;

    async function loadDeferredPanels() {
      try {
        const result = await loadHeavy();
        if (cancelled || result.kind !== "success") return;

        setCommandCenter((current) =>
          current
            ? {
                ...current,
                fileQuality: result.data.fileQuality,
                fileQualityError: result.data.fileQualityError,
                taskSuggestions: result.data.taskSuggestions,
                suggestionsError: result.data.suggestionsError,
                tasks: result.data.tasks,
                tasksError: result.data.tasksError,
                notes: result.data.notes,
                notesError: result.data.notesError,
                timing: {
                  ...current.timing,
                  totalMs:
                    current.timing.totalMs + result.data.timing.totalMs,
                  fileQualityMs: result.data.timing.fileQualityMs,
                  taskSuggestionsMs: result.data.timing.taskSuggestionsMs,
                  tasksMs: result.data.timing.tasksMs,
                  notesMs: result.data.timing.notesMs,
                },
              }
            : current,
        );
        setOpenTaskCountOverride(null);
      } catch {
        // keep shell data if heavy panels fail
      }
    }

    void loadDeferredPanels();

    return () => {
      cancelled = true;
    };
  }, [mode, loadHeavy]);

  const refreshCommandCenter = useCallback(async () => {
    setRefreshing(true);

    try {
      const shellResult = await loadShell();
      if (shellResult.kind === "success") {
        setCommandCenter(shellResult.data);
        setOpenTaskCountOverride(null);
      }

      const heavyResult = await loadHeavy();
      if (heavyResult.kind === "success") {
        setCommandCenter((current) =>
          current
            ? {
                ...current,
                fileQuality: heavyResult.data.fileQuality,
                fileQualityError: heavyResult.data.fileQualityError,
                taskSuggestions: heavyResult.data.taskSuggestions,
                suggestionsError: heavyResult.data.suggestionsError,
                tasks: heavyResult.data.tasks,
                tasksError: heavyResult.data.tasksError,
                notes: heavyResult.data.notes,
                notesError: heavyResult.data.notesError,
                timing: {
                  ...current.timing,
                  totalMs:
                    current.timing.totalMs + heavyResult.data.timing.totalMs,
                  fileQualityMs: heavyResult.data.timing.fileQualityMs,
                  taskSuggestionsMs: heavyResult.data.timing.taskSuggestionsMs,
                  tasksMs: heavyResult.data.timing.tasksMs,
                  notesMs: heavyResult.data.timing.notesMs,
                },
              }
            : current,
        );
        setOpenTaskCountOverride(null);
      }
    } catch {
      // keep existing data on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [loadShell, loadHeavy]);

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

      <nav
        aria-label="Client workspace tabs"
        className="sticky top-14 z-20 -mx-1 flex flex-wrap gap-1 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/90 px-2 py-2 backdrop-blur-md sm:top-16"
      >
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-sm px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] transition-colors ${
              activeTab === tab.id
                ? "bg-[#D1A866]/15 text-[#D1A866]"
                : "text-[#F3F1EA]/45 hover:bg-[#D1A866]/8 hover:text-[#D1A866]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="space-y-6">
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

          <AdvisorClientRoadmapPanel
            roadmap={commandCenter.roadmap}
            completionPercent={commandCenter.roadmapCompletionPercent}
          />

          <AdvisorClientTasksPanel
            clientId={clientId}
            initialTasks={commandCenter.tasks}
            error={commandCenter.tasksError}
            viewer={commandCenter.viewer}
            onRetry={() => void refreshCommandCenter()}
            onOpenTaskCountChange={handleOpenTaskCountChange}
          />

          <AdvisorClientActivityPanel
            activity={
              commandCenter.activityError ? null : commandCenter.recentActivity
            }
            error={commandCenter.activityError}
            onRetry={() => void refreshCommandCenter()}
          />
        </div>
      )}

      {activeTab === "financial-profile" && (
        <AdvisorClientScorePanel
          client={commandCenter.client}
          discover={commandCenter.discover}
          profile={commandCenter.profile}
          shield={commandCenter.shield}
          awri={commandCenter.awri}
          benchmark={commandCenter.benchmark}
        />
      )}

      {activeTab === "shield-diagnostic" && (
        <section className="space-y-6">
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

          <AdvisorClientReviewPanel
            clientId={clientId}
            review={commandCenter.review}
            error={commandCenter.reviewError}
            onRetry={() => void refreshCommandCenter()}
            onStatusUpdated={handleReviewUpdated}
            onReviewRefreshed={handleReviewRefreshed}
          />
        </section>
      )}

      {activeTab === "budget" && (
        <AdvisorClientBudgetPanel clientId={clientId} />
      )}

      {activeTab === "protection-reports" && (
        <AdvisorClientReportsPanel
          clientId={clientId}
          wealthBlueprintHistory={commandCenter.wealthBlueprintHistory}
          annualReviewHistory={commandCenter.annualReviewHistory}
          metadataError={commandCenter.reportsError}
          onRetry={() => void refreshCommandCenter()}
        />
      )}

      {activeTab === "document-vault" && (
        <AdvisorClientDocumentsPanel
          clientId={clientId}
          documents={commandCenter.documents}
          loadError={commandCenter.documentsError}
          onRetry={() => void refreshCommandCenter()}
        />
      )}

      {activeTab === "appointments" && (
        <AdvisorClientAppointmentsPanel clientId={clientId} />
      )}

      {activeTab === "feedback" && (
        <AdvisorClientFeedbackPanel clientId={clientId} />
      )}

      {activeTab === "notes" && (
        <AdvisorClientNotesPanel
          clientId={clientId}
          initialNotes={commandCenter.notes}
          error={commandCenter.notesError}
          viewer={commandCenter.viewer}
          onRetry={() => void refreshCommandCenter()}
        />
      )}
    </div>
  );
}
