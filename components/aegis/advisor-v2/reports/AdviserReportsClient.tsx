"use client";

import Link from "next/link";

import type {
  AdviserReportsProjectionDto,
  ReportCardDto,
  ReportSectionDto,
} from "@/lib/crm-v2/reports/types";

function trendLabel(trend: ReportCardDto["trendDirection"]): string {
  switch (trend) {
    case "up":
      return "Increasing";
    case "down":
      return "Decreasing";
    case "flat":
      return "Stable";
    default:
      return "Not tracked";
  }
}

function ReportCard({ card }: { card: ReportCardDto }) {
  return (
    <Link
      href={card.routeHref}
      className="group block rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/60 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/70"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#F3F1EA]/90">{card.title}</p>
          <p className="mt-1 text-xs text-[#F3F1EA]/45">{card.sourceModule}</p>
          <p className="mt-2 text-sm text-[#F3F1EA]/55">{card.summary}</p>
        </div>
        {card.safeCount !== null ? (
          <span className="shrink-0 rounded-full bg-[#F3F1EA]/8 px-3 py-1 text-sm font-medium text-[#D1A866]">
            {card.safeCount}
            {card.safePercentage !== null ? ` (${card.safePercentage}%)` : ""}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#F3F1EA]/40">
        <span>{card.dateRangeLabel}</span>
        <span>Trend: {trendLabel(card.trendDirection)}</span>
        {card.partialDataWarning ? <span className="text-[#D1A866]/80">Partial data</span> : null}
      </div>
    </Link>
  );
}

function ReportSection({ section }: { section: ReportSectionDto }) {
  return (
    <section aria-labelledby={`report-section-${section.key}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`report-section-${section.key}`} className="text-base font-medium text-[#F3F1EA]/85">
          {section.label}
        </h2>
        <Link
          href={section.workspaceHref}
          className="text-xs text-[#D1A866]/75 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
        >
          Open workspace
        </Link>
      </div>
      <p className="text-xs text-[#F3F1EA]/40">{section.dateRangeLabel}</p>

      {section.partialFailure ? (
        <p className="rounded-md border border-[#D1A866]/20 bg-[#D1A866]/5 px-3 py-2 text-xs text-[#F3F1EA]/55">
          Some sources could not be loaded for this section.
        </p>
      ) : null}

      {section.cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#F3F1EA]/10 px-4 py-6 text-sm text-[#F3F1EA]/40">
          {section.emptyMessage}
        </p>
      ) : (
        <ul className="space-y-3">
          {section.cards.map((card) => (
            <li key={card.reportKey}>
              <ReportCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Props = {
  initialReports: AdviserReportsProjectionDto | null;
  loadError: string | null;
  featureDisabled: boolean;
};

export function AdviserReportsClient({ initialReports, loadError, featureDisabled }: Props) {
  if (featureDisabled) {
    return (
      <div className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/40 px-6 py-10 text-center">
        <p className="text-sm text-[#F3F1EA]/60">CRM V2 Reports is not enabled.</p>
      </div>
    );
  }

  if (loadError || !initialReports) {
    return (
      <div className="rounded-lg border border-[#E07A5F]/20 bg-[#E07A5F]/5 px-6 py-10 text-center">
        <p className="text-sm text-[#F3F1EA]/60">{loadError ?? "Unable to load reports."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A1F1C]/40 px-4 py-3">
        <p className="text-sm text-[#F3F1EA]/70">
          Bounded adviser-scoped projections — no ranking, revenue or sales-priority signals.
        </p>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          {initialReports.dateRange.from} to {initialReports.dateRange.to} ({initialReports.dateRange.days} days)
        </p>
        {initialReports.adminScopeDeferred ? (
          <p className="mt-2 text-xs text-[#D1A866]/80">
            Book-wide reports are deferred for admin — adviser assignment required.
          </p>
        ) : null}
        {initialReports.sourceFailures.length > 0 ? (
          <p className="mt-2 text-xs text-[#D1A866]/80">
            Some report sources could not be loaded completely.
          </p>
        ) : null}
      </header>

      <div className="grid gap-8">
        {initialReports.sections.map((section) => (
          <ReportSection key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}
