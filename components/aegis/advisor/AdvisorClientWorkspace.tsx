"use client";

import { useEffect, useState } from "react";

import AdvisorClientAccessDenied from "@/components/aegis/advisor/AdvisorClientAccessDenied";
import AdvisorClientActivityPanel from "@/components/aegis/advisor/AdvisorClientActivityPanel";
import AdvisorClientDocumentsPanel from "@/components/aegis/advisor/AdvisorClientDocumentsPanel";
import AdvisorClientNotesPanel from "@/components/aegis/advisor/AdvisorClientNotesPanel";
import AdvisorClientTasksPanel from "@/components/aegis/advisor/AdvisorClientTasksPanel";
import AdvisorClientHeader from "@/components/aegis/advisor/AdvisorClientHeader";
import AdvisorClientReviewPanel from "@/components/aegis/advisor/AdvisorClientReviewPanel";
import AdvisorClientPillarPanel from "@/components/aegis/advisor/AdvisorClientPillarPanel";
import AdvisorClientReportsPanel from "@/components/aegis/advisor/AdvisorClientReportsPanel";
import AdvisorClientRoadmapPanel from "@/components/aegis/advisor/AdvisorClientRoadmapPanel";
import AdvisorClientScorePanel from "@/components/aegis/advisor/AdvisorClientScorePanel";
import AdvisorClientStressPanel from "@/components/aegis/advisor/AdvisorClientStressPanel";
import type { AdvisorClientWorkspace as WorkspaceData } from "@/lib/supabase/advisorClientQueries";

type WorkspaceMode =
  | "loading"
  | "ready"
  | "forbidden"
  | "not_found"
  | "error";

interface AdvisorClientWorkspaceProps {
  clientId: string;
}

export default function AdvisorClientWorkspace({
  clientId,
}: AdvisorClientWorkspaceProps) {
  const [mode, setMode] = useState<WorkspaceMode>("loading");
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  }, [clientId]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-16 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading client workspace…
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
            Client Workspace
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

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdvisorClientHeader
        client={workspace.client}
        adjustedShieldScore={workspace.shield?.adjustedShieldScore ?? null}
        rating={workspace.shield?.rating ?? null}
      />

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
        }}
      />

      <AdvisorClientScorePanel
        client={workspace.client}
        discover={workspace.discover}
        profile={workspace.profile}
        shield={workspace.shield}
        awri={workspace.awri}
        benchmark={workspace.benchmark}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdvisorClientPillarPanel
          pillarScores={pillarScores}
          weakestPillar={workspace.insights?.weakestPillar ?? null}
          strongestPillar={workspace.insights?.strongestPillar ?? null}
        />
        <AdvisorClientRoadmapPanel
          roadmap={workspace.roadmap}
          completionPercent={workspace.roadmapCompletionPercent}
        />
      </div>

      <AdvisorClientStressPanel
        topStressExposures={workspace.topStressExposures}
        stressHistory={workspace.stressHistory}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdvisorClientDocumentsPanel
          clientId={clientId}
          documents={workspace.documents}
        />
        <AdvisorClientActivityPanel activity={workspace.recentActivity} />
      </div>

      <AdvisorClientTasksPanel clientId={clientId} />

      <AdvisorClientNotesPanel clientId={clientId} />

      <AdvisorClientReportsPanel
        clientId={clientId}
        wealthBlueprintHistory={workspace.wealthBlueprintHistory}
        annualReviewHistory={workspace.annualReviewHistory}
      />
    </div>
  );
}
