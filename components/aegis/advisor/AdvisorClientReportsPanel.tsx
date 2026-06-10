"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type {
  AdvisorAnnualReviewEntry,
  AdvisorWealthBlueprintEntry,
} from "@/lib/supabase/advisorClientQueries";

interface AdvisorClientReportsPanelProps {
  wealthBlueprintHistory: AdvisorWealthBlueprintEntry[];
  annualReviewHistory: AdvisorAnnualReviewEntry[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvisorClientReportsPanel({
  wealthBlueprintHistory,
  annualReviewHistory,
}: AdvisorClientReportsPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Reports
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Wealth Blueprint and Annual Review history
        </p>
      </div>

      <div className="relative grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-[#D1A866]/8">
        <div>
          <p className="border-b border-[#D1A866]/8 px-5 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
            Wealth Blueprint
          </p>
          {wealthBlueprintHistory.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm font-light text-[#F3F1EA]/45">
                No blueprint reports saved.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#D1A866]/8">
              {wealthBlueprintHistory.map((entry) => (
                <li key={entry.id} className="px-5 py-4">
                  <p className="text-sm font-light text-[#F3F1EA]">
                    {entry.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-mono tabular-nums text-[#D1A866]">
                      {entry.adjustedShieldScore != null
                        ? formatScore(entry.adjustedShieldScore)
                        : "—"}{" "}
                      {entry.rating ? `· ${entry.rating}` : ""}
                    </span>
                    {entry.awri != null && (
                      <span className="font-mono text-[#F3F1EA]/50">
                        AWRI {formatScore(entry.awri)}
                      </span>
                    )}
                    <span className="text-[#F3F1EA]/35">
                      {formatDate(entry.generatedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="border-b border-[#D1A866]/8 px-5 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
            Annual Review
          </p>
          {annualReviewHistory.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm font-light text-[#F3F1EA]/45">
                No annual reviews saved.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#D1A866]/8">
              {annualReviewHistory.map((entry) => (
                <li key={entry.id} className="px-5 py-4">
                  <p className="text-sm font-light text-[#F3F1EA]">
                    {entry.reviewLabel ?? `${entry.reviewYear} Annual Review`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-mono tabular-nums text-[#D1A866]">
                      {formatScore(entry.adjustedShieldScore)} · {entry.rating}
                    </span>
                    <span className="text-[#F3F1EA]/35">
                      {formatDate(entry.generatedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
