"use client";

interface AdminMetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  highlight?: boolean;
}

export default function AdminMetricCard({
  label,
  value,
  sublabel,
  highlight = false,
}: AdminMetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative flex min-w-0 flex-col gap-1.5">
        <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          {label}
        </span>
        <span
          className={`font-mono text-2xl font-light tabular-nums tracking-tight sm:text-3xl ${
            highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
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
