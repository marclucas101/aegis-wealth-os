import { formatPercent, formatScore } from "@/components/aegis/ShieldScoreCard";
import type { ShieldRating } from "@/src/lib/scoring/types";

interface ScoreMetricProps {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}

function ScoreMetric({ label, value, sublabel, highlight = false }: ScoreMetricProps) {
  return (
    <div className="border border-[#10283A]/10 bg-white px-4 py-4">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[#10283A]/45">
        {label}
      </p>
      <p
        className={`mt-1.5 font-mono text-xl tabular-nums ${
          highlight ? "text-[#B8860B]" : "text-[#10283A]"
        }`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[10px] text-[#10283A]/45">{sublabel}</p>
      ) : null}
    </div>
  );
}

interface ReportScoreSummaryProps {
  adjustedShieldScore?: number | null;
  rawShieldScore?: number | null;
  rating?: ShieldRating | null;
  awri?: number | null;
  awriRating?: string | null;
  discoverScore?: number | null;
  dataConfidenceFactor?: number | null;
  projectedScore?: number | null;
  projectedRating?: ShieldRating | null;
  scoreMovement?: number | null;
}

export default function ReportScoreSummary({
  adjustedShieldScore,
  rawShieldScore,
  rating,
  awri,
  awriRating,
  discoverScore,
  dataConfidenceFactor,
  projectedScore,
  projectedRating,
  scoreMovement,
}: ReportScoreSummaryProps) {
  const hasAnyScore =
    adjustedShieldScore != null ||
    rating != null ||
    awri != null ||
    discoverScore != null;

  if (!hasAnyScore) {
    return (
      <p className="text-sm font-light text-[#10283A]/50">
        Score data is not available for this report snapshot.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {adjustedShieldScore != null ? (
        <ScoreMetric
          label="Adjusted Shield Score"
          value={formatScore(adjustedShieldScore)}
          sublabel={rating ? `${rating} rating` : undefined}
          highlight
        />
      ) : null}

      {rawShieldScore != null ? (
        <ScoreMetric
          label="Raw Shield Score"
          value={formatScore(rawShieldScore)}
          sublabel="Unadjusted composite"
        />
      ) : null}

      {rating && adjustedShieldScore == null ? (
        <ScoreMetric label="Shield Rating" value={rating} highlight />
      ) : null}

      {awri != null ? (
        <ScoreMetric
          label="AWRI™"
          value={formatScore(awri)}
          sublabel={awriRating ? `Rating ${awriRating}` : "Architecture Wealth Resilience Index"}
        />
      ) : null}

      {discoverScore != null ? (
        <ScoreMetric
          label="Discover Score"
          value={formatScore(discoverScore)}
          sublabel="Profile completeness index"
        />
      ) : null}

      {dataConfidenceFactor != null ? (
        <ScoreMetric
          label="Data Confidence"
          value={formatPercent(dataConfidenceFactor)}
          sublabel="Input reliability weight"
        />
      ) : null}

      {projectedScore != null ? (
        <ScoreMetric
          label="Projected Shield Score"
          value={formatScore(projectedScore)}
          sublabel={
            projectedRating
              ? `${projectedRating} on roadmap completion`
              : "On roadmap completion"
          }
          highlight
        />
      ) : null}

      {scoreMovement != null ? (
        <ScoreMetric
          label="Projected Improvement"
          value={`${scoreMovement >= 0 ? "+" : ""}${formatScore(scoreMovement)}`}
          sublabel="Estimated score movement"
          highlight={scoreMovement > 0}
        />
      ) : null}
    </div>
  );
}
