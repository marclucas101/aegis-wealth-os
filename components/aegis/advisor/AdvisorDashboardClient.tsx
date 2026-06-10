"use client";

import { useEffect, useMemo, useState } from "react";

import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorBookHealthPanel from "@/components/aegis/advisor/AdvisorBookHealthPanel";
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
import AdvisorTodayPanel from "@/components/aegis/advisor/AdvisorTodayPanel";
import AdvisorSearchFilters, {
  type AdvisorFilters,
} from "@/components/aegis/advisor/AdvisorSearchFilters";
import type { AdvisorOverview } from "@/lib/supabase/advisorQueries";

type AdvisorMode = "loading" | "empty" | "ready" | "error" | "forbidden";

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

export default function AdvisorDashboardClient() {
  const [mode, setMode] = useState<AdvisorMode>("loading");
  const [overview, setOverview] = useState<AdvisorOverview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdvisorFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        const response = await fetch("/api/advisor/overview", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 401) {
          setMode("error");
          setErrorMessage("Authentication required.");
          return;
        }

        if (response.status === 403) {
          setMode("forbidden");
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & AdvisorOverview)
          | { ok: false; reason?: string; error?: string };

        if (!data.ok) {
          setMode("error");
          setErrorMessage(data.error ?? "Failed to load advisor overview.");
          return;
        }

        setOverview(data);
        setMode(data.totalClients === 0 ? "empty" : "ready");
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load advisor overview.");
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredClients = useMemo(() => {
    if (!overview) return [];

    return overview.clients.filter((client) => {
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
  }, [overview, filters]);

  async function refreshOverview() {
    try {
      const response = await fetch("/api/advisor/overview", {
        cache: "no-store",
      });
      const data = (await response.json()) as
        | ({ ok: true } & AdvisorOverview)
        | { ok: false };

      if (data.ok) {
        setOverview(data);
        setMode(data.totalClients === 0 ? "empty" : "ready");
      }
    } catch {
      // keep current overview on refresh failure
    }
  }

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading advisor console…
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
      </div>
    );
  }

  if (mode === "empty" || !overview) {
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

  return (
    <div className="space-y-6 sm:space-y-8">
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
          <AdvisorTodayPanel />
          <AdvisorNotificationCenter />
        </div>
        <div className="space-y-6">
          <AdvisorBookHealthPanel overview={overview} />
          <AdvisorPriorityClients clients={overview.priorityClients} />
        </div>
      </div>

      <AdvisorReviewPipelinePanel />

      <AdvisorTaskPanel />

      <AdvisorClientOnboardingPanel
        defaultExpanded={false}
        onClientCreated={() => {
          void refreshOverview();
        }}
      />

      <section id="advisor-clients" className="space-y-4 scroll-mt-24">
        <AdvisorSearchFilters
          filters={filters}
          onChange={setFilters}
          resultCount={filteredClients.length}
          totalCount={overview.clients.length}
        />
        <AdvisorClientTable clients={filteredClients} />
      </section>

      <AdvisorRecentActivity activity={overview.recentActivity} />
    </div>
  );
}
