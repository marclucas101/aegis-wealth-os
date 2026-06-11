"use client";

import Image from "next/image";

import {
  HorizontalBar,
  IlpAllocationVisual,
  PersonCard,
  PremiumVisual,
  ReportPrintPage,
  formatSumAssuredDisplay,
  policyFooterLabel,
  ValueComparisonVisual,
} from "@/components/aegis/advisor/protection-report/ProtectionReportVisuals";
import { BRAND } from "@/lib/brand";
import {
  buildProtectionNarratives,
  calculateAnnualPremium,
  calculateMonthlyPremium,
  calculatePolicyCount,
  calculateTotalCoverage,
  calculateTotalPaidToDate,
  formatCurrency,
  getFundsByPolicy,
  summarizeProtectionReport,
  type ProtectionReportInput,
} from "@/src/features/advisor-console/protection-report";

interface ProtectionReportPreviewProps {
  data: ProtectionReportInput;
}

function getInsuredPersonName(
  data: ProtectionReportInput,
  insuredPersonId: string
): string {
  return (
    data.insuredPersons.find((person) => person.id === insuredPersonId)?.fullName ??
    "Unknown"
  );
}

function sortPoliciesForPortfolio(data: ProtectionReportInput) {
  return [...data.policies].sort((a, b) => {
    const aNumeric = a.sumAssuredLabel ? -1 : a.sumAssured;
    const bNumeric = b.sumAssuredLabel ? -1 : b.sumAssured;
    return bNumeric - aNumeric;
  });
}

function KpiCard({
  label,
  value,
  sublabel,
  compact = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  compact?: boolean;
}) {
  return (
    <div className="report-print-avoid-break rounded-sm border border-[#10283A]/10 bg-[#F8F7F4] px-4 py-3">
      <p className="text-[8px] font-medium uppercase tracking-[0.2em] text-[#10283A]/45">
        {label}
      </p>
      <p
        className={`mt-1.5 font-mono font-light tabular-nums text-[#10283A] ${
          compact ? "text-xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[10px] font-light leading-snug text-[#10283A]/50">
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

export default function ProtectionReportPreview({ data }: ProtectionReportPreviewProps) {
  const narratives = buildProtectionNarratives(data);
  const summary = summarizeProtectionReport(data);
  const coverage = calculateTotalCoverage(data.policies);
  const monthlyPremium = calculateMonthlyPremium(data.policies);
  const annualPremium = calculateAnnualPremium(data.policies);
  const paidToDate = calculateTotalPaidToDate(data.policies);
  const sortedPolicies = sortPoliciesForPortfolio(data);

  const maxCoverage = Math.max(
    ...sortedPolicies
      .filter((policy) => !policy.sumAssuredLabel)
      .map((policy) => policy.sumAssured),
    1
  );
  const maxPremium = Math.max(
    ...sortedPolicies.map((policy) => policy.monthlyPremium ?? 0),
    1
  );
  const maxCurrentValue = Math.max(
    ...sortedPolicies.map((policy) => policy.currentValue ?? 0),
    1
  );

  const portfolioPageIndex = 3;
  const policyStartPage = 4;

  return (
    <div
      id="protection-report-print-root"
      className="protection-report-preview report-print-root bg-white text-[#10283A]"
    >
      {/* Page 1 — Cover */}
      <ReportPrintPage footerLabel="COVER" footerIndex={1}>
        <div className="flex items-start justify-between gap-4">
          <Image
            src={BRAND.assets.logo}
            alt={BRAND.fullName}
            width={180}
            height={39}
            className="h-7 w-auto"
            unoptimized
          />
          <Image
            src={BRAND.assets.monogram}
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 opacity-30"
            unoptimized
            aria-hidden
          />
        </div>

        <p className="mt-6 text-[9px] font-medium uppercase tracking-[0.32em] text-[#10283A]/45">
          A Personal Report · Prepared with Care
        </p>

        <h1 className="mt-4 text-[2.35rem] font-light leading-[1.08] tracking-wide text-[#10283A]">
          Your
          <br />
          Protection
          <br />
          Portfolio.
        </h1>

        <p className="mt-4 max-w-lg text-[13px] font-light leading-relaxed text-[#10283A]/60">
          {narratives.coverIntro}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard
            compact
            label="Coverage in Force"
            value={formatCurrency(summary.coverageInForce, { compact: true })}
            sublabel={
              coverage.nonNumericLabels.length > 0
                ? `across ${calculatePolicyCount(data.policies)} policies · plus ${coverage.nonNumericLabels.join(", ")}`
                : `across ${calculatePolicyCount(data.policies)} policies`
            }
          />
          <KpiCard
            compact
            label="Number of Policies"
            value={String(summary.policyCount)}
          />
          <KpiCard
            compact
            label="Monthly Premium"
            value={formatCurrency(monthlyPremium)}
            sublabel={`${formatCurrency(annualPremium)} per year`}
          />
          <KpiCard
            compact
            label="Annual Premium"
            value={formatCurrency(annualPremium)}
          />
          <KpiCard
            compact
            label="Value Today"
            value={formatCurrency(summary.valueToday)}
            sublabel={
              paidToDate > 0 ? `of ${formatCurrency(paidToDate)} paid in` : undefined
            }
          />
        </div>

        <div className="mt-8 grid gap-6 border-t border-[#10283A]/10 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#10283A]/40">
              Prepared For
            </p>
            <p className="mt-1.5 text-lg font-light text-[#10283A]">
              {data.household.householdName}
            </p>
            <p className="mt-1.5 text-[13px] font-light text-[#10283A]/60">
              Primary contact: {data.household.primaryContact}
            </p>
            <p className="text-[13px] font-light text-[#10283A]/60">
              Statement period: {data.household.statementPeriod}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#10283A]/40">
              Prepared By
            </p>
            <p className="mt-1.5 text-lg font-light text-[#10283A]">
              {data.household.adviserName}
            </p>
            <p className="mt-1.5 text-[13px] font-light text-[#10283A]/60">
              {data.household.adviserCompany}
            </p>
          </div>
        </div>

        <p className="mt-6 text-[9px] uppercase tracking-[0.2em] text-[#10283A]/35">
          Confidential · {data.household.adviserCompany}
        </p>
      </ReportPrintPage>

      {/* Page 2 — The People */}
      <ReportPrintPage footerLabel="THE PEOPLE" footerIndex={2}>
        <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-[#D1A866]">
          Section One
        </p>
        <h2 className="mt-1.5 text-3xl font-light tracking-wide text-[#10283A]">
          The People.
        </h2>
        <p className="mt-1.5 text-sm font-light text-[#10283A]/55">
          {narratives.peopleIntro}
        </p>

        <blockquote className="report-print-avoid-break mt-6 border-l-2 border-[#D1A866]/50 pl-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#10283A]/40">
            Why We Plan
          </p>
          <p className="mt-1.5 max-w-2xl text-sm font-light italic leading-relaxed text-[#10283A]/70">
            &ldquo;{narratives.peopleQuote}&rdquo;
          </p>
        </blockquote>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {data.insuredPersons.map((person) => (
            <PersonCard
              key={person.id}
              relationship={person.relationship}
              fullName={person.fullName}
              age={person.age}
              healthNotes={person.healthNotes}
            />
          ))}
        </div>
      </ReportPrintPage>

      {/* Page 3 — The Portfolio */}
      <ReportPrintPage footerLabel="THE PORTFOLIO" footerIndex={portfolioPageIndex}>
        <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-[#D1A866]">
          Section Two
        </p>
        <h2 className="mt-1.5 text-3xl font-light tracking-wide text-[#10283A]">
          The Portfolio.
        </h2>
        <p className="mt-1.5 text-sm font-light text-[#10283A]/55">
          {narratives.portfolioIntro}
        </p>

        <div className="report-print-avoid-break mt-6 space-y-3 rounded-sm border border-[#10283A]/10 bg-white p-4">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
            Coverage by Policy
          </p>
          {sortedPolicies.map((policy) => (
            <HorizontalBar
              key={`cov-${policy.id}`}
              label={policy.planName}
              sublabel={`${getInsuredPersonName(data, policy.insuredPersonId)} · ${policy.policyType}`}
              value={policy.sumAssuredLabel ? 0 : policy.sumAssured}
              maxValue={maxCoverage}
              displayValue={formatSumAssuredDisplay(policy)}
              badge={policy.sumAssuredLabel}
            />
          ))}
          {coverage.nonNumericLabels.length > 0 ? (
            <p className="text-[10px] font-light italic text-[#10283A]/45">
              Non-numeric coverage ({coverage.nonNumericLabels.join(", ")}) is
              shown but excluded from the numeric total.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="report-print-avoid-break space-y-3 rounded-sm border border-[#10283A]/10 p-4">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
              Premium by Policy
            </p>
            {sortedPolicies.map((policy) => (
              <HorizontalBar
                key={`prem-${policy.id}`}
                label={policy.planName}
                value={policy.monthlyPremium ?? 0}
                maxValue={maxPremium}
                displayValue={
                  policy.monthlyPremium !== undefined
                    ? `${formatCurrency(policy.monthlyPremium)} / mo`
                    : "—"
                }
                accent="navy"
                showBar={(policy.monthlyPremium ?? 0) > 0}
              />
            ))}
          </div>

          <div className="report-print-avoid-break space-y-3 rounded-sm border border-[#10283A]/10 p-4">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
              Current Value by Policy
            </p>
            {sortedPolicies.map((policy) => (
              <HorizontalBar
                key={`val-${policy.id}`}
                label={policy.planName}
                value={policy.currentValue ?? 0}
                maxValue={maxCurrentValue}
                displayValue={
                  policy.currentValue !== undefined
                    ? formatCurrency(policy.currentValue)
                    : "Protection-only"
                }
                accent="muted"
                showBar={(policy.currentValue ?? 0) > 0}
                badge={
                  policy.currentValue === undefined ? "No cash value" : undefined
                }
              />
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {sortedPolicies.map((policy) => {
            const covValue = policy.sumAssuredLabel ? 0 : policy.sumAssured;
            const covPct =
              !policy.sumAssuredLabel && maxCoverage > 0
                ? Math.max(4, (covValue / maxCoverage) * 100)
                : 0;

            return (
              <div
                key={policy.id}
                className="report-print-avoid-break rounded-sm border border-[#10283A]/8 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-light leading-snug text-[#10283A]">
                      {policy.planName}
                    </p>
                    <p className="mt-0.5 text-[11px] font-light text-[#10283A]/50">
                      {getInsuredPersonName(data, policy.insuredPersonId)} ·{" "}
                      {policy.insurer} · {policy.policyType}
                    </p>
                  </div>
                  <div className="text-right">
                    {policy.sumAssuredLabel ? (
                      <span className="inline-block rounded-sm border border-[#D1A866]/40 bg-[#F8F7F4] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#10283A]/70">
                        {policy.sumAssuredLabel}
                      </span>
                    ) : (
                      <span className="font-mono text-sm tabular-nums text-[#10283A]">
                        {formatCurrency(policy.sumAssured)}
                      </span>
                    )}
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-[#10283A]/55">
                      {policy.monthlyPremium !== undefined
                        ? `${formatCurrency(policy.monthlyPremium)} / mo`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-sm bg-[#10283A]/8">
                  {policy.sumAssuredLabel ? (
                    <div className="h-full w-full bg-[#D1A866]/20 print-color-bar" />
                  ) : (
                    <div
                      className="h-full rounded-sm bg-[#D1A866] print-color-bar"
                      style={{ width: `${covPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <KpiCard
            compact
            label="Total Coverage"
            value={formatCurrency(summary.coverageInForce, { compact: true })}
          />
          <KpiCard
            compact
            label="Monthly Outlay"
            value={formatCurrency(monthlyPremium)}
          />
        </div>
      </ReportPrintPage>

      {/* Policy detail pages — one per policy */}
      {data.policies.map((policy, index) => {
        const funds = getFundsByPolicy(data.investmentFunds, policy.id);
        const insuredName = getInsuredPersonName(data, policy.insuredPersonId);
        const annual =
          policy.annualPremium ??
          (policy.monthlyPremium !== undefined ? policy.monthlyPremium * 12 : undefined);
        const pageIndex = policyStartPage + index;

        return (
          <ReportPrintPage
            key={policy.id}
            footerLabel={policyFooterLabel(policy.planName)}
            footerIndex={pageIndex}
          >
            <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-[#D1A866]">
              Policy {String(index + 1).padStart(2, "0")} · {policy.policyType}
            </p>
            <h2 className="mt-1.5 text-2xl font-light tracking-wide text-[#10283A]">
              {policy.planName}
            </h2>
            <p className="mt-1 text-sm font-light text-[#10283A]/55">
              For {insuredName} · {policy.insurer}
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="report-print-avoid-break rounded-sm border border-[#D1A866]/25 bg-[#F8F7F4] p-4 lg:col-span-2">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
                  Sum Assured
                </p>
                {policy.sumAssuredLabel ? (
                  <span className="mt-2 inline-block rounded-sm border border-[#D1A866]/45 bg-white px-4 py-2 text-lg font-light uppercase tracking-[0.12em] text-[#10283A]">
                    {policy.sumAssuredLabel}
                  </span>
                ) : (
                  <p className="mt-2 font-mono text-3xl font-light tabular-nums text-[#10283A]">
                    {formatCurrency(policy.sumAssured)}
                  </p>
                )}
                <p className="mt-3 text-sm font-light text-[#10283A]/65">
                  Covers: {policy.whatItCovers}
                </p>
              </div>

              <div className="report-print-avoid-break rounded-sm border border-[#10283A]/10 p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
                  Premium & Tenure
                </p>
                <div className="mt-3">
                  <PremiumVisual
                    monthlyPremium={policy.monthlyPremium}
                    annualPremium={annual}
                    formatCurrency={formatCurrency}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#10283A]/8 pt-3 text-sm">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#10283A]/40">
                      Premium Term
                    </p>
                    <p className="mt-1 font-light text-[#10283A]">
                      {policy.premiumTerm ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#10283A]/40">
                      Policy Term
                    </p>
                    <p className="mt-1 font-light text-[#10283A]">
                      {policy.policyTerm ?? "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#10283A]/40">
                      Policy Start
                    </p>
                    <p className="mt-1 font-light text-[#10283A]">
                      {policy.policyStart ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="report-print-avoid-break rounded-sm border border-[#10283A]/10 p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
                  Financials Today
                </p>
                <div className="mt-3">
                  <ValueComparisonVisual
                    currentValue={policy.currentValue}
                    paidToDate={policy.paidToDate}
                    formatCurrency={formatCurrency}
                  />
                </div>
                {policy.projectedValue ? (
                  <div className="mt-4 rounded-sm border border-[#D1A866]/20 bg-[#F8F7F4] px-3 py-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-[#D1A866]">
                      Projected Value at Maturity
                    </p>
                    <p className="mt-1 text-sm font-light text-[#10283A]">
                      {policy.projectedValue}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="report-print-avoid-break rounded-sm border border-[#10283A]/10 p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
                  Beneficiary
                </p>
                <p className="mt-2 text-sm font-light leading-relaxed text-[#10283A]">
                  {policy.beneficiary ?? "—"}
                </p>
              </div>

              <div className="report-print-avoid-break rounded-sm border border-[#10283A]/10 p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
                  Policy Number
                </p>
                <p className="mt-2 font-mono text-sm text-[#10283A]/75">
                  {policy.policyNumber}
                </p>
              </div>
            </div>

            {funds.length > 0 ? (
              <div className="report-print-avoid-break mt-4 rounded-sm border border-[#D1A866]/25 bg-[#F8F7F4] p-4">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
                  Investment Allocation
                </p>
                <div className="mt-4">
                  <IlpAllocationVisual
                    funds={funds}
                    formatCurrency={formatCurrency}
                    formatPercent={(value) => `${value.toFixed(0)}%`}
                  />
                </div>
              </div>
            ) : null}
          </ReportPrintPage>
        );
      })}

      {/* Final — What's Next */}
      <ReportPrintPage footerLabel="WHAT'S NEXT" footerIndex="FINAL">
        <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-[#D1A866]">
          Section Final
        </p>
        <h2 className="mt-1.5 text-3xl font-light tracking-wide text-[#10283A]">
          What&apos;s Next.
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-[#10283A]/55">
          {narratives.finalGuidance}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Annual Review",
              body: "Once a year, revisit the whole portfolio together. Check coverage levels, premium load, and life changes.",
            },
            {
              title: "Life Event Triggers",
              body: "Marriage, new child, new home, job change, or business start. Each event reshapes what protection should look like.",
            },
            {
              title: "Statement Refresh",
              body: "Cash values and projections update with each annual statement. This document is refreshed with the latest figures every year.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="report-print-avoid-break rounded-sm border border-[#10283A]/10 bg-[#F8F7F4] px-4 py-4"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#D1A866]">
                {item.title}
              </p>
              <p className="mt-2 text-sm font-light leading-relaxed text-[#10283A]/65">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-sm border border-[#D1A866]/30 bg-white px-5 py-5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
            Your Adviser
          </p>
          <p className="mt-2 text-xl font-light text-[#10283A]">
            {data.household.adviserName}
          </p>
          <p className="mt-1 text-sm font-light text-[#10283A]/60">
            {data.household.adviserCompany}
          </p>
          <p className="mt-3 text-sm font-light text-[#10283A]/55">
            Statement dated: {data.household.statementPeriod}
          </p>
          <p className="mt-3 text-sm font-light italic text-[#10283A]/65">
            {narratives.adviserClosing}
          </p>
        </div>

        <div className="report-print-avoid-break mt-6 border-t border-[#10283A]/10 pt-5">
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#10283A]/40">
            Confidentiality Notice
          </p>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#10283A]/65">
            Confidential. Prepared for the named household only. This report is a
            structured summary based on information provided and should be reviewed
            against official policy documents.
          </p>
        </div>
      </ReportPrintPage>
    </div>
  );
}
