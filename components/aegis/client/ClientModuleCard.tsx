"use client";

import Link from "next/link";
import type { ClientModuleCardData } from "@/lib/aegis/clientJourney";

type ClientModuleCardProps = ClientModuleCardData;

const ACCENT_BORDER: Record<
  NonNullable<ClientModuleCardData["accent"]>,
  string
> = {
  gold: "border-[#D1A866]/35 hover:border-[#D1A866]/50",
  emerald: "border-emerald-500/25 hover:border-emerald-500/40",
  neutral: "border-[#D1A866]/12 hover:border-[#D1A866]/25",
};

const ACCENT_BADGE: Record<
  NonNullable<ClientModuleCardData["accent"]>,
  string
> = {
  gold: "border-[#D1A866]/40 bg-[#D1A866]/10 text-[#D1A866]",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90",
  neutral: "border-[#F3F1EA]/12 bg-[#F3F1EA]/5 text-[#F3F1EA]/45",
};

export default function ClientModuleCard({
  title,
  description,
  href,
  statusLabel,
  accent = "neutral",
}: ClientModuleCardProps) {
  return (
    <Link
      href={href}
      className={`group flex h-full flex-col rounded-sm border bg-[#10283A]/60 p-5 transition-all hover:bg-[#10283A]/80 sm:p-6 ${ACCENT_BORDER[accent]}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-light text-[#F3F1EA]">{title}</p>
        {statusLabel && (
          <span
            className={`shrink-0 rounded-sm border px-2 py-0.5 text-[8px] uppercase tracking-wider ${ACCENT_BADGE[accent]}`}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <p className="flex-1 text-xs font-light leading-relaxed text-[#F3F1EA]/45">
        {description}
      </p>
      <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#D1A866]/60 group-hover:text-[#D1A866]">
        Open module →
      </p>
    </Link>
  );
}
