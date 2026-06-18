"use client";

import { useEffect, useState } from "react";

import type { AdvisorClientShieldDiagnosticResponse } from "@/app/api/advisor/clients/[clientId]/shield-diagnostic/route";
import AdvisorClientReadOnlyBanner from "@/components/aegis/advisor/AdvisorClientReadOnlyBanner";
import ShieldDiagnosticSummary from "@/components/aegis/shield/ShieldDiagnosticSummary";
import ShieldPillarCards from "@/components/aegis/shield/ShieldPillarCards";
import ShieldReadinessPanel from "@/components/aegis/shield/ShieldReadinessPanel";

type PanelMode = "loading" | "empty" | "ready" | "error";

interface AdvisorClientShieldDiagnosticPanelProps {
  clientId: string;
}

export default function AdvisorClientShieldDiagnosticPanel({
  clientId,
}: AdvisorClientShieldDiagnosticPanelProps) {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [snapshot, setSnapshot] = useState<
    Extract<AdvisorClientShieldDiagnosticResponse, { ok: true }> | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      setMode("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/shield-diagnostic`,
          { cache: "no-store" },
        );

        if (cancelled) return;

        if (response.status === 403 || response.status === 404) {
          setMode("error");
          setErrorMessage("Unable to load this client diagnostic.");
          return;
        }

        const data =
          (await response.json()) as AdvisorClientShieldDiagnosticResponse;

        if (data.ok) {
          setSnapshot(data);
          setMode("ready");
          return;
        }

        if (data.reason === "no_profile") {
          setSnapshot(null);
          setMode("empty");
          return;
        }

        setMode("error");
        setErrorMessage(data.error ?? "Failed to load shield diagnostic.");
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load shield diagnostic.");
      }
    }

    void loadDiagnostic();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading shield diagnostic…
        </p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-6 py-10 text-center">
        <p className="text-sm font-light text-red-200/80">
          {errorMessage ?? "Unable to load shield diagnostic."}
        </p>
      </div>
    );
  }

  if (mode === "empty" || !snapshot) {
    return (
      <div className="space-y-4">
        <AdvisorClientReadOnlyBanner />
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-12 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/50">
            This client has not completed Discover yet. Their Shield Diagnostic
            will appear here once a current profile exists.
          </p>
        </div>
      </div>
    );
  }

  const weakestPillarKeys = snapshot.weakestPillars.map((item) => item.pillar);

  return (
    <div className="space-y-6">
      <AdvisorClientReadOnlyBanner />

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/35 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
          Shield Diagnostic
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/55">
          Seven-pillar financial health check — same scores the client sees in
          their portal.
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/30">
          Profile from{" "}
          {new Date(snapshot.completedAt).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 px-5 py-4">
        <p className="text-sm font-light text-[#F3F1EA]/55">
          <span className="text-[#F3F1EA]/75">Adviser note: </span>
          Focus on flagged pillar gaps first — they represent the largest
          improvement opportunity for this client.
        </p>
      </div>

      <ShieldDiagnosticSummary shield={snapshot.shield} />
      <ShieldPillarCards
        pillarScores={snapshot.shield.pillarScores}
        weakestPillars={weakestPillarKeys}
      />
      <ShieldReadinessPanel weakestPillars={snapshot.weakestPillars} />
    </div>
  );
}
