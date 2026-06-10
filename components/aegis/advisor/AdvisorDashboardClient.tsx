"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorBookHealthPanel from "@/components/aegis/advisor/AdvisorBookHealthPanel";
import AdvisorBookQualityPanel from "@/components/aegis/advisor/AdvisorBookQualityPanel";
import AdvisorClientOnboardingPanel from "@/components/aegis/advisor/AdvisorClientOnboardingPanel";
import AdvisorClientTable from "@/components/aegis/advisor/AdvisorClientTable";
import AdvisorCommandHeader from "@/components/aegis/advisor/AdvisorCommandHeader";
import AdvisorCommandMetrics from "@/components/aegis/advisor/AdvisorCommandMetrics";
import AdvisorEmptyState from "@/components/aegis/advisor/AdvisorEmptyState";
import AdvisorNotificationCenter from "@/components/aegis/advisor/AdvisorNotificationCenter";
import AdvisorPriorityClients from "@/components/aegis/advisor/AdvisorPriorityClients";
import AdvisorQuickActions from "@/components/aegis/advisor/AdvisorQuickActions";
import AdvisorRecentActivity from "@/components/aegis/advisor/AdvisorRecentActivity";
import AdvisorReviewPipelinePanel from "@/components/aegis/advisor/AdvisorReviewPipelinePanel";
import AdvisorTaskPanel from "@/components/aegis/advisor/AdvisorTaskPanel";
import AdvisorTaskSuggestionsPanel from "@/components/aegis/advisor/AdvisorTaskSuggestionsPanel";
import AdvisorTodayPanel from "@/components/aegis/advisor/AdvisorTodayPanel";
import AdvisorSearchFilters, {
  type AdvisorFilters,
} from "@/components/aegis/advisor/AdvisorSearchFilters";
import type { AdvisorCommandCenterResponse } from "@/app/api/advisor/command-center/route";
import type { AdvisorOverview } from "@/lib/supabase/advisorQueries";
import type { AdvisorNotificationsPayload } from "@/lib/supabase/advisorNotifications";
import type { AdvisorReviewPipeline } from "@/lib/supabase/advisorReviewPipeline";
import type { AdvisorTaskDashboard } from "@/lib/supabase/advisorTasks";
import type {
  AdvisorBookFileQuality,
  ClientFileQualitySummary,
} from "@/lib/supabase/clientFileQuality";
import type { AdvisorTaskSuggestionsPayload } from "@/lib/supabase/advisorTaskSuggestions";
import type { OnboardingClientRecord } from "@/lib/supabase/clientOnboarding";

type AdvisorMode = "loading" | "empty" | "ready" | "error" | "forbidden";

type CommandCenterData = {
  overview: AdvisorOverview;
  notifications: AdvisorNotificationsPayload | null;
  notificationsError: string | null;
  taskDashboard: AdvisorTaskDashboard | null;
  tasksError: string | null;
  reviewPipeline: AdvisorReviewPipeline | null;
  reviewPipelineError: string | null;
  fileQuality: AdvisorBookFileQuality | null;
  fileQualityError: string | null;
  fileQualityByClientId: ClientFileQualitySummary[];
  taskSuggestions: AdvisorTaskSuggestionsPayload | null;
  suggestionsError: string | null;
  onboardingClients: OnboardingClientRecord[];
  onboardingError: string | null;
  viewer: { userId: string; role: "advisor" | "admin" };
};

const DEFAULT_FILTERS: AdvisorFilters = {
  search: "",
  status: "all",
  rating: "all",
  riskLevel: "all",
};

const ANCHOR_SECTIONS = [
  { id: "advisor-today", label: "Today" },
  { id: "advisor-review-pipeline", label: "Pipeline" },
  { id: "advisor-tasks", label: "Tasks" },
  { id: "advisor-suggested-followups", label: "Follow-Ups" },
  { id: "advisor-clients", label: "Clients" },
  { id: "advisor-activity", label: "Activity" },
] as const;

function matchesSearch(
  client: AdvisorOverview["clients"][number],
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return (
    client.displayName.toLowerCase().includes(query) ||
    (client.email?.toLowerCase().includes(query) ?? false)
  );
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function extractCommandCenterData(
  data: Extract<AdvisorCommandCenterResponse, { ok: true }>,
): CommandCenterData {
  return {
    overview: data.overview,
    notifications: data.notifications,
    notificationsError: data.notificationsError,
    taskDashboard: data.taskDashboard,
    tasksError: data.tasksError,
    reviewPipeline: data.reviewPipeline,
    reviewPipelineError: data.reviewPipelineError,
    fileQuality: data.fileQuality,
    fileQualityError: data.fileQualityError,
    fileQualityByClientId: data.fileQualityByClientId,
    taskSuggestions: data.taskSuggestions,
    suggestionsError: data.suggestionsError,
    onboardingClients: data.onboardingClients,
    onboardingError: data.onboardingError,
    viewer: data.viewer,
  };
}

export default function AdvisorDashboardClient() {
  const [mode, setMode] = useState<AdvisorMode>("loading");
  const [commandCenter, setCommandCenter] = useState<CommandCenterData | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdvisorFilters>(DEFAULT_FILTERS);
  const [refreshing, setRefreshing] = useState(false);

  const loadCommandCenter = useCallback(async () => {
    const response = await fetch("/api/advisor/command-center", {
      cache: "no-store",
    });

    if (response.status === 401) {
      return { kind: "unauthenticated" as const };
    }

    if (response.status === 403) {
      return { kind: "forbidden" as const };
    }

    const data = (await response.json()) as AdvisorCommandCenterResponse;

    if (!data.ok) {
      return {
        kind: "error" as const,
        message: data.error ?? "Failed to load advisor command center.",
      };
    }

    return {
      kind: "success" as const,
      data: extractCommandCenterData(data),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const result = await loadCommandCenter();
        if (cancelled) return;

        if (result.kind === "unauthenticated") {
          setMode("error");
          setErrorMessage("Authentication required.");
          return;
        }

        if (result.kind === "forbidden") {
          setMode("forbidden");
          return;
        }

        if (result.kind === "error") {
          setMode("error");
          setErrorMessage(result.message);
          return;
        }

        setCommandCenter(result.data);
        setMode(
          result.data.overview.totalClients === 0 ? "empty" : "ready",
        );
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load advisor command center.");
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
        setMode(
          result.data.overview.totalClients === 0 ? "empty" : "ready",
        );
      }
    } catch {
      // keep current dashboard on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [loadCommandCenter]);

  const filteredClients = useMemo(() => {
    if (!commandCenter) return [];

    return commandCenter.overview.clients.filter((client) => {
      if (!matchesSearch(client, filters.search)) return false;
      if (filters.status !== "all" && client.status !== filters.status) {
        return false;
      }
      if (filters.rating !== "all" && client.rating !== filters.rating) {
        return false;
      }
      if (
        filters.riskLevel !== "all" &&
        client.riskLevel !== filters.riskLevel
      ) {
        return false;
      }
      return true;
    });
  }, [commandCenter, filters]);

  const fileQualityByClientId = useMemo(() => {
    return new Map(
      (commandCenter?.fileQualityByClientId ?? []).map((client) => [
        client.clientId,
        client,
      ]),
    );
  }, [commandCenter?.fileQualityByClientId]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading advisor console…
        </p>
        <p className="mt-2 text-xs font-light text-[#F3F1EA]/25">
          Consolidating book overview, tasks, reviews, and alerts.
        </p>
      </div>
    );
  }

  if (mode === "forbidden") {
    return <AdvisorAccessDenied />;
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-6 py-12 text-center">
        <p className="text-sm font-light text-red-200/80">
          {errorMessage ?? "Unable to load advisor console."}
        </p>
        <button
          type="button"
          onClick={() => {
            setMode("loading");
            void loadCommandCenter().then((result) => {
              if (result.kind === "success") {
                setCommandCenter(result.data);
                setMode(
                  result.data.overview.totalClients === 0 ? "empty" : "ready",
                );
              } else if (result.kind === "forbidden") {
                setMode("forbidden");
              } else {
                setMode("error");
                setErrorMessage(
                  result.kind === "error"
                    ? result.message
                    : "Authentication required.",
                );
              }
            });
          }}
          className="mt-4 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (mode === "empty" || !commandCenter) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <AdvisorClientOnboardingPanel
          defaultExpanded
          onClientCreated={() => {
            window.location.reload();
          }}
        />
        <AdvisorEmptyState />
      </div>
    );
  }

  const { overview } = commandCenter;

  return (
    <div className="space-y-6 sm:space-y-8">
      {refreshing ? (
        <p className="text-center text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/30">
          Refreshing advisor console…
        </p>
      ) : null}

      <AdvisorCommandHeader overview={overview} />

      <nav
        aria-label="Advisor console sections"
        className="sticky top-14 z-20 -mx-1 flex flex-wrap gap-1 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/90 px-2 py-2 backdrop-blur-md sm:top-16"
      >
        {ANCHOR_SECTIONS.map((section) => (
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

      <AdvisorCommandMetrics overview={overview} />

      <AdvisorQuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AdvisorTodayPanel
            notifications={commandCenter.notifications}
            notificationsError={commandCenter.notificationsError}
            taskDashboard={commandCenter.taskDashboard}
            tasksError={commandCenter.tasksError}
            reviewPipeline={commandCenter.reviewPipeline}
            reviewPipelineError={commandCenter.reviewPipelineError}
            onRefresh={refreshCommandCenter}
          />
          <AdvisorNotificationCenter
            payload={commandCenter.notifications}
            errorMessage={commandCenter.notificationsError}
            onRefresh={refreshCommandCenter}
          />
        </div>
        <div className="space-y-6">
          <AdvisorBookHealthPanel overview={overview} />
          <AdvisorBookQualityPanel
            bookQuality={commandCenter.fileQuality}
            errorMessage={commandCenter.fileQualityError}
          />
          <AdvisorPriorityClients clients={overview.priorityClients} />
        </div>
      </div>

      <AdvisorReviewPipelinePanel
        pipeline={commandCenter.reviewPipeline}
        errorMessage={commandCenter.reviewPipelineError}
        onRefresh={refreshCommandCenter}
      />

      <AdvisorTaskPanel
        dashboard={commandCenter.taskDashboard}
        errorMessage={commandCenter.tasksError}
        viewer={commandCenter.viewer}
        onRefresh={refreshCommandCenter}
      />

      <AdvisorTaskSuggestionsPanel
        payload={commandCenter.taskSuggestions}
        errorMessage={commandCenter.suggestionsError}
        onRefresh={refreshCommandCenter}
      />

      <AdvisorClientOnboardingPanel
        defaultExpanded={false}
        initialClients={commandCenter.onboardingClients}
        initialError={commandCenter.onboardingError}
        onClientCreated={() => {
          void refreshCommandCenter();
        }}
      />

      <section id="advisor-clients" className="space-y-4 scroll-mt-24">
        <AdvisorSearchFilters
          filters={filters}
          onChange={setFilters}
          resultCount={filteredClients.length}
          totalCount={overview.clients.length}
        />
        <AdvisorClientTable
          clients={filteredClients}
          fileQualityByClientId={fileQualityByClientId}
        />
      </section>

      <AdvisorRecentActivity activity={overview.recentActivity} />
    </div>
  );
}
