"use client";

import { useEffect, useMemo, useState } from "react";

import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import AdvisorClientTable from "@/components/aegis/advisor/AdvisorClientTable";
import AdvisorEmptyState from "@/components/aegis/advisor/AdvisorEmptyState";
import AdvisorMetricCard from "@/components/aegis/advisor/AdvisorMetricCard";
import AdvisorPriorityClients from "@/components/aegis/advisor/AdvisorPriorityClients";
import AdvisorRecentActivity from "@/components/aegis/advisor/AdvisorRecentActivity";
import AdvisorSearchFilters, {
  type AdvisorFilters,
} from "@/components/aegis/advisor/AdvisorSearchFilters";
import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AdvisorOverview } from "@/lib/supabase/advisorQueries";

type AdvisorMode = "loading" | "empty" | "ready" | "error" | "forbidden";

const DEFAULT_FILTERS: AdvisorFilters = {
  search: "",
  status: "all",
  rating: "all",
  riskLevel: "all",
};

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
    return <AdvisorEmptyState />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdvisorMetricCard
          label="Total clients"
          value={overview.totalClients}
          sublabel={`${overview.activeClients} active · ${overview.onboardingClients} onboarding`}
        />
        <AdvisorMetricCard
          label="Average Shield Score"
          value={
            overview.averageShieldScore != null
              ? formatScore(overview.averageShieldScore)
              : "—"
          }
          highlight
        />
        <AdvisorMetricCard
          label="High-risk clients"
          value={overview.highRiskClients}
          sublabel="Shield, stress, or review signals"
        />
        <AdvisorMetricCard
          label="Pending roadmap items"
          value={overview.pendingRoadmapItems}
          sublabel={`${overview.documentsUploaded} documents uploaded`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdvisorPriorityClients clients={overview.priorityClients} />
        <AdvisorRecentActivity activity={overview.recentActivity} />
      </div>

      <div className="space-y-4">
        <AdvisorSearchFilters
          filters={filters}
          onChange={setFilters}
          resultCount={filteredClients.length}
          totalCount={overview.clients.length}
        />
        <AdvisorClientTable clients={filteredClients} />
      </div>
    </div>
  );
}
