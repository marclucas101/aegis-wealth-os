"use client";

import type { ReactNode } from "react";

import type { InvestmentFund, Policy } from "@/src/features/advisor-console/protection-report";

export function formatSumAssuredDisplay(policy: Policy): string {
  if (policy.sumAssuredLabel) {
    return policy.sumAssuredLabel;
  }
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(policy.sumAssured);
}

export function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function policyFooterLabel(planName: string): string {
  return planName.replace(/[^a-zA-Z0-9]+/g, " ").trim().toUpperCase().slice(0, 28);
}

interface ReportPrintPageProps {
  children: ReactNode;
  footerLabel: string;
  footerIndex: number | "FINAL";
  className?: string;
}

export function ReportPrintPage({
  children,
  footerLabel,
  footerIndex,
  className = "",
}: ReportPrintPageProps) {
  const footerText =
    footerIndex === "FINAL"
      ? `— FINAL — ${footerLabel}`
      : `— ${footerIndex} — ${footerLabel}`;

  return (
    <section
      className={`print-page protection-print-page report-print-avoid-break ${className}`}
    >
      <div className="protection-print-page-inner flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
        <footer className="protection-report-page-footer mt-auto pt-6 text-center text-[9px] uppercase tracking-[0.22em] text-[#10283A]/35">
          {footerText}
        </footer>
      </div>
    </section>
  );
}

interface HorizontalBarProps {
  label: string;
  sublabel?: string;
  value: number;
  maxValue: number;
  displayValue: string;
  badge?: string;
  accent?: "gold" | "navy" | "muted";
  showBar?: boolean;
}

export function HorizontalBar({
  label,
  sublabel,
  value,
  maxValue,
  displayValue,
  badge,
  accent = "gold",
  showBar = true,
}: HorizontalBarProps) {
  const pct =
    showBar && maxValue > 0 && value > 0
      ? Math.max(4, Math.min(100, (value / maxValue) * 100))
      : 0;

  const barColor =
    accent === "gold"
      ? "bg-[#D1A866]"
      : accent === "navy"
        ? "bg-[#10283A]"
        : "bg-[#10283A]/35";

  return (
    <div className="report-print-avoid-break">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-light leading-snug text-[#10283A]">{label}</p>
          {sublabel ? (
            <p className="mt-0.5 text-[10px] font-light text-[#10283A]/45">{sublabel}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          {badge ? (
            <span className="inline-block rounded-sm border border-[#D1A866]/40 bg-[#F8F7F4] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#10283A]/70">
              {badge}
            </span>
          ) : (
            <span className="font-mono text-sm tabular-nums text-[#10283A]">
              {displayValue}
            </span>
          )}
        </div>
      </div>
      {showBar && !badge ? (
        <div className="mt-2 h-2.5 overflow-hidden rounded-sm bg-[#10283A]/8">
          <div
            className={`h-full rounded-sm ${barColor} print-color-bar`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : badge ? (
        <div className="mt-2 h-1 rounded-sm bg-[#D1A866]/25" />
      ) : null}
    </div>
  );
}

interface ValueComparisonVisualProps {
  currentValue?: number;
  paidToDate?: number;
  formatCurrency: (value: number) => string;
}

export function ValueComparisonVisual({
  currentValue,
  paidToDate,
  formatCurrency,
}: ValueComparisonVisualProps) {
  const hasCurrent = currentValue !== undefined && currentValue > 0;
  const hasPaid = paidToDate !== undefined && paidToDate > 0;

  if (!hasCurrent && !hasPaid) {
    return (
      <div className="rounded-sm border border-dashed border-[#10283A]/15 bg-[#F8F7F4] px-4 py-5 text-center">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#D1A866]">
          Protection-Only Policy
        </p>
        <p className="mt-2 text-sm font-light text-[#10283A]/55">
          No cash value component — coverage-led protection.
        </p>
      </div>
    );
  }

  const max = Math.max(currentValue ?? 0, paidToDate ?? 0, 1);
  const currentPct = hasCurrent ? Math.max(6, ((currentValue ?? 0) / max) * 100) : 0;
  const paidPct = hasPaid ? Math.max(6, ((paidToDate ?? 0) / max) * 100) : 0;

  return (
    <div className="space-y-4">
      {hasCurrent ? (
        <div>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-[#10283A]/45">
            <span>Current Cash Value</span>
            <span className="font-mono tabular-nums text-[#10283A]">
              {formatCurrency(currentValue!)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm bg-[#10283A]/8">
            <div
              className="h-full rounded-sm bg-[#D1A866] print-color-bar"
              style={{ width: `${currentPct}%` }}
            />
          </div>
        </div>
      ) : null}
      {hasPaid ? (
        <div>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-[#10283A]/45">
            <span>Paid to Date</span>
            <span className="font-mono tabular-nums text-[#10283A]">
              {formatCurrency(paidToDate!)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm bg-[#10283A]/8">
            <div
              className="h-full rounded-sm bg-[#10283A]/55 print-color-bar"
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>
      ) : null}
      {hasCurrent && hasPaid ? (
        <p className="text-xs font-light text-[#10283A]/50">
          Current value represents {Math.round(((currentValue ?? 0) / (paidToDate ?? 1)) * 100)}%
          of premiums paid to date.
        </p>
      ) : null}
    </div>
  );
}

interface PremiumVisualProps {
  monthlyPremium?: number;
  annualPremium?: number;
  formatCurrency: (value: number) => string;
}

export function PremiumVisual({
  monthlyPremium,
  annualPremium,
  formatCurrency,
}: PremiumVisualProps) {
  if (monthlyPremium === undefined) {
    return <p className="text-sm font-light text-[#10283A]/50">—</p>;
  }

  const annual = annualPremium ?? monthlyPremium * 12;
  const monthlyShare = monthlyPremium / annual;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#10283A]/40">
            Premium per Month
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-[#10283A]">
            {formatCurrency(monthlyPremium)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#10283A]/40">
            Per Year
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums text-[#10283A]/75">
            {formatCurrency(annual)}
          </p>
        </div>
      </div>
      <div className="flex h-4 overflow-hidden rounded-sm border border-[#10283A]/10">
        <div
          className="flex items-center justify-center bg-[#D1A866] text-[8px] uppercase tracking-[0.1em] text-[#10283A] print-color-bar"
          style={{ width: `${Math.max(12, monthlyShare * 100)}%` }}
        >
          Mo
        </div>
        <div className="flex flex-1 items-center justify-center bg-[#10283A]/8 text-[8px] uppercase tracking-[0.1em] text-[#10283A]/45">
          Annualised
        </div>
      </div>
    </div>
  );
}

interface IlpAllocationVisualProps {
  funds: InvestmentFund[];
  formatCurrency: (value: number) => string;
  formatPercent: (value: number) => string;
}

const DONUT_COLORS = ["#D1A866", "#10283A", "#B8860B", "#1A2A2B", "#C9A227"];

export function IlpAllocationVisual({
  funds,
  formatCurrency,
  formatPercent,
}: IlpAllocationVisualProps) {
  const totalPercent = funds.reduce((sum, fund) => sum + fund.allocationPercent, 0);
  const isValid = Math.abs(totalPercent - 100) <= 0.01;

  const segments = funds.reduce<
    Array<{
      fund: InvestmentFund;
      start: number;
      end: number;
      color: string;
    }>
  >((accumulator, fund, index) => {
    const start = accumulator.length
      ? accumulator[accumulator.length - 1].end
      : 0;
    const end = start + fund.allocationPercent;
    accumulator.push({
      fund,
      start,
      end,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
    });
    return accumulator;
  }, []);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grid gap-6 lg:grid-cols-[140px_1fr]">
      <div className="mx-auto flex flex-col items-center">
        <svg
          viewBox="0 0 100 100"
          className="h-32 w-32 shrink-0"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#10283A14"
            strokeWidth="14"
          />
          {segments.map((segment) => {
            const dash = (segment.fund.allocationPercent / 100) * circumference;
            const offset = (segment.start / 100) * circumference;
            return (
              <circle
                key={segment.fund.id}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
                className="print-color-bar"
              />
            );
          })}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            className="fill-[#10283A] text-[11px] font-light"
            style={{ fontSize: "9px" }}
          >
            {formatPercent(totalPercent)}
          </text>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            className="fill-[#10283A99] text-[8px]"
            style={{ fontSize: "6px" }}
          >
            allocated
          </text>
        </svg>
        <p
          className={`mt-2 text-[10px] uppercase tracking-[0.12em] ${
            isValid ? "text-emerald-700/80" : "text-amber-800/80"
          }`}
        >
          {isValid ? "100% allocated" : `Total ${formatPercent(totalPercent)}`}
        </p>
      </div>

      <div className="space-y-4">
        {funds.map((fund, index) => (
          <div key={fund.id} className="report-print-avoid-break">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-light text-[#10283A]">{fund.fundName}</p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-[#10283A]/55">
                  {formatCurrency(fund.currentValue)}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums text-[#10283A]">
                {formatPercent(fund.allocationPercent)}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-sm bg-[#10283A]/8">
              <div
                className="h-full rounded-sm print-color-bar"
                style={{
                  width: `${Math.max(4, fund.allocationPercent)}%`,
                  backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PersonCardProps {
  relationship: string;
  fullName: string;
  age: number;
  healthNotes: string;
}

export function PersonCard({
  relationship,
  fullName,
  age,
  healthNotes,
}: PersonCardProps) {
  return (
    <article className="report-print-avoid-break flex gap-4 rounded-sm border border-[#10283A]/10 bg-[#F8F7F4] p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-[#D1A866]/35 bg-white text-sm font-light tracking-wide text-[#10283A]">
        {getInitials(fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-[0.16em] text-[#D1A866]">
          {relationship}
        </p>
        <p className="mt-1 text-lg font-light text-[#10283A]">{fullName}</p>
        <p className="mt-0.5 text-sm font-light text-[#10283A]/55">Age {age}</p>
        {healthNotes ? (
          <div className="mt-3 border-t border-[#10283A]/8 pt-2">
            <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/40">
              Note
            </p>
            <p className="mt-1 text-sm font-light leading-relaxed text-[#10283A]/65">
              {healthNotes}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
