"use client";

import { formatCurrency } from "@/components/aegis/ShieldScoreCard";

interface ClientPortalHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  clientName?: string;
  clientDetail?: string;
  netWorth?: number;
  badge?: import("react").ReactNode;
  className?: string;
}

export default function ClientPortalHeader({
  eyebrow = "Your AEGIS Portal",
  title,
  subtitle,
  clientName,
  clientDetail,
  netWorth,
  badge,
  className = "",
}: ClientPortalHeaderProps) {
  const showProfile = clientName || clientDetail || netWorth != null;

  return (
    <header
      className={`relative mb-8 overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 pb-6 pt-6 sm:mb-10 sm:pb-8 sm:pt-8 ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/6 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative px-5 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            {badge}
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
              {subtitle}
            </p>
          </div>

          {showProfile && (
            <div className="shrink-0 rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3 text-left sm:text-right">
              {clientName && (
                <>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                    Welcome back
                  </p>
                  <p className="mt-1 text-sm text-[#F3F1EA]">{clientName}</p>
                </>
              )}
              {clientDetail && (
                <p className="mt-1 text-xs text-[#F3F1EA]/45">{clientDetail}</p>
              )}
              {netWorth != null && (
                <p className="mt-2 font-mono text-xs tabular-nums text-[#D1A866]/75">
                  Net worth {formatCurrency(netWorth)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
