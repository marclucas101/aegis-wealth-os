"use client";

import { useEffect, useState } from "react";

import AdvisorMetricCard from "@/components/aegis/advisor/AdvisorMetricCard";
import type { AdvisorBookFileQuality } from "@/lib/supabase/clientFileQuality";

type LoadState = "loading" | "ready" | "error";

export default function AdvisorBookQualityPanel() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [bookQuality, setBookQuality] = useState<AdvisorBookFileQuality | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBookQuality() {
      try {
        const response = await fetch("/api/advisor/file-quality", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (!response.ok) {
          setLoadState("error");
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & AdvisorBookFileQuality)
          | { ok: false };

        if (!data.ok) {
          setLoadState("error");
          return;
        }

        const { ok: _ok, ...quality } = data;
        setBookQuality(quality);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    void loadBookQuality();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Book Quality
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Client-file readiness and data completeness across your mandate.
        </p>
      </div>

      <div className="relative grid gap-3 px-5 py-5 sm:grid-cols-2">
        <AdvisorMetricCard
          label="Average readiness score"
          value={
            loadState === "loading"
              ? "…"
              : bookQuality?.averageReadinessScore != null
                ? `${bookQuality.averageReadinessScore}%`
                : "—"
          }
          highlight
          compact
        />
        <AdvisorMetricCard
          label="Review-ready clients"
          value={
            loadState === "loading"
              ? "…"
              : (bookQuality?.reviewReadyCount ?? "—")
          }
          sublabel="Files meeting review criteria"
          compact
        />
        <AdvisorMetricCard
          label="Incomplete files"
          value={
            loadState === "loading"
              ? "…"
              : (bookQuality?.incompleteFilesCount ?? "—")
          }
          sublabel="Not yet review-ready"
          alert={
            loadState === "ready" &&
            bookQuality != null &&
            bookQuality.incompleteFilesCount > 0
          }
          compact
        />
        <AdvisorMetricCard
          label="Critical gaps"
          value={
            loadState === "loading"
              ? "…"
              : (bookQuality?.criticalGapsCount ?? "—")
          }
          sublabel="Across all client files"
          alert={
            loadState === "ready" &&
            bookQuality != null &&
            bookQuality.criticalGapsCount > 0
          }
          compact
        />
        <AdvisorMetricCard
          label="Needs data cleanup"
          value={
            loadState === "loading"
              ? "…"
              : (bookQuality?.clientsNeedingCleanup ?? "—")
          }
          sublabel="Poor, incomplete, or critical gaps"
          alert={
            loadState === "ready" &&
            bookQuality != null &&
            bookQuality.clientsNeedingCleanup > 0
          }
          compact
          className="sm:col-span-2"
        />
      </div>

      {loadState === "error" ? (
        <p className="relative px-5 pb-4 text-xs font-light text-[#F3F1EA]/35">
          Book quality metrics unavailable. Open individual client workspaces
          for file quality detail.
        </p>
      ) : null}
    </section>
  );
}
