"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { FinancialOverviewResponse } from "@/app/api/client/financial-overview/route";
import ActiveClientPortalShellBar from "@/components/aegis/client/ActiveClientPortalShellBar";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import CallMyAdviserPanel from "@/components/aegis/adviser/CallMyAdviserPanel";
import FinancialReadinessSnapshotView from "@/components/aegis/client/FinancialReadinessSnapshotView";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

export default function ActiveClientFinancialOverviewClient() {
  const [data, setData] = useState<FinancialOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/client/financial-overview", {
          cache: "no-store",
        });
        const payload = (await response.json()) as FinancialOverviewResponse;
        if (!cancelled) {
          setData(payload);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center text-sm text-[#F3F1EA]/40">
        Loading your financial overview…
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-6 py-8 text-sm text-amber-100/80">
        {data && !data.ok ? data.error : "Unable to load your overview."}
      </div>
    );
  }

  const { shell, overview, roadmapProgressPercent, goalCount } = data.data;

  return (
    <>
      <ClientPortalHeader
        eyebrow={CLIENT_TERMINOLOGY.financialOverview}
        title={`Welcome back, ${shell.welcomeName}`}
        subtitle="Your adviser-led planning overview — broad categories and agreed priorities only."
        clientName={shell.clientDisplayName}
      />

      <ActiveClientPortalShellBar shell={shell} />

      {overview.reviewRecommended ? (
        <div className="mb-6 rounded-sm border border-amber-500/25 bg-amber-500/10 px-5 py-4">
          <p className="text-sm text-amber-100/90">
            {CLIENT_TERMINOLOGY.reviewRecommended}. Your last reviewed summary may no longer
            reflect your current circumstances.
          </p>
          <Link
            href="/my-adviser"
            className="mt-3 inline-block text-sm font-medium text-[#D1A866] underline-offset-2 hover:underline"
          >
            Book a review appointment
          </Link>
        </div>
      ) : null}

      <FinancialReadinessSnapshotView
        envelope={
          overview as import("@/lib/compliance/clientSafeDtos").ClientSafeEnvelope<import("@/lib/compliance/clientSafeDtos").ClientSafeFinancialReadinessSnapshot>
        }
        embedded
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#D1A866]/65">
            Roadmap progress
          </p>
          <p className="mt-2 text-2xl font-light tabular-nums text-[#F3F1EA]">
            {roadmapProgressPercent}%
          </p>
          <Link href="/roadmap" className="mt-2 inline-block text-xs text-[#D1A866]">
            View roadmap →
          </Link>
        </section>

        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#D1A866]/65">
            Active goals
          </p>
          <p className="mt-2 text-2xl font-light tabular-nums text-[#F3F1EA]">
            {goalCount}
          </p>
          <Link href="/goals-reviews" className="mt-2 inline-block text-xs text-[#D1A866]">
            Manage goals →
          </Link>
        </section>
      </div>

      {shell.lastReviewedDate ? (
        <p className="mt-6 text-xs text-[#F3F1EA]/40">
          Last adviser review: {new Date(shell.lastReviewedDate).toLocaleDateString()}
          {shell.dataAsAt
            ? ` · ${CLIENT_TERMINOLOGY.dataAsAt(shell.dataAsAt)}`
            : null}
        </p>
      ) : null}

      <div className="mt-8">
        <CallMyAdviserPanel />
      </div>

      <div className="mt-8">
        <ClientTrustNotice context="general" />
      </div>
    </>
  );
}
