import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { BenchmarkResult } from "@/src/lib/scoring/types";

interface BenchmarkCardProps {
  benchmark: BenchmarkResult;
}

function classificationTone(classification: BenchmarkResult["classification"]): string {
  switch (classification) {
    case "Leading":
      return "text-[#D1A866] border-[#D1A866]/40 bg-[#D1A866]/10";
    case "Above Average":
      return "text-[#D1A866]/90 border-[#D1A866]/30 bg-[#D1A866]/5";
    case "In Line":
      return "text-[#F3F1EA]/80 border-[#F3F1EA]/20 bg-[#F3F1EA]/5";
    case "Below Average":
      return "text-[#F3F1EA]/60 border-[#F3F1EA]/15 bg-transparent";
    case "Materially Behind":
      return "text-[#F3F1EA]/45 border-[#F3F1EA]/10 bg-transparent";
  }
}

function BenchmarkBar({
  label,
  value,
  max = 100,
  highlight = false,
}: {
  label: string;
  value: number;
  max?: number;
  highlight?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px]">
        <span className="text-[#F3F1EA]/50">{label}</span>
        <span
          className={`shrink-0 font-mono tabular-nums ${highlight ? "text-[#D1A866]" : "text-[#F3F1EA]/70"}`}
        >
          {formatScore(value)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#071B2A]">
        <div
          className={`h-full rounded-full ${highlight ? "bg-[#D1A866]" : "bg-[#F3F1EA]/25"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BenchmarkCard({ benchmark }: BenchmarkCardProps) {
  const deltaSign = benchmark.benchmarkDelta >= 0 ? "+" : "";

  return (
    <section className="flex h-full flex-col rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Benchmark Engine™
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Cohort Comparison
        </h3>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
              Benchmark Cohort
            </p>
            <p className="mt-1 text-sm text-[#F3F1EA]">{benchmark.cohort}</p>
          </div>
          <span
            className={`rounded-sm border px-2.5 py-1 text-[10px] uppercase tracking-wider ${classificationTone(benchmark.classification)}`}
          >
            {benchmark.classification}
          </span>
        </div>

        <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
            Delta vs Cohort Average
          </p>
          <p className="mt-1 font-mono text-2xl font-light tabular-nums text-[#D1A866]">
            {deltaSign}
            {formatScore(benchmark.benchmarkDelta)}
            <span className="ml-1 text-sm text-[#F3F1EA]/40">pts</span>
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <BenchmarkBar
            label="Your Shield Score"
            value={benchmark.clientScore}
            highlight
          />
          <BenchmarkBar label="Cohort Average" value={benchmark.cohortAverage} />
          <BenchmarkBar label="Top 25%" value={benchmark.top25} />
          <BenchmarkBar label="Top 10%" value={benchmark.top10} />
        </div>
      </div>
    </section>
  );
}
