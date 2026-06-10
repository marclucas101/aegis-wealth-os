"use client";

interface AdvisorMetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  highlight?: boolean;
  alert?: boolean;
  compact?: boolean;
  className?: string;
}

export default function AdvisorMetricCard({
  label,
  value,
  sublabel,
  highlight = false,
  alert = false,
  compact = false,
  className = "",
}: AdvisorMetricCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-sm border bg-[#10283A]/60 ${
        alert
          ? "border-red-400/25 bg-red-400/5"
          : "border-[#D1A866]/15"
      } ${compact ? "p-4" : "p-5"} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative flex min-w-0 flex-col gap-1.5">
        <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          {label}
        </span>
        <span
          className={`font-mono font-light tabular-nums tracking-tight ${
            compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
          } ${
            highlight
              ? "text-[#D1A866]"
              : alert
                ? "text-red-200/90"
                : "text-[#F3F1EA]"
          }`}
        >
          {value}
        </span>
        {sublabel && (
          <span className="text-xs font-light text-[#F3F1EA]/40">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
