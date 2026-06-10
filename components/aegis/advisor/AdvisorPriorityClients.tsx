"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { PriorityClient } from "@/lib/supabase/advisorQueries";

interface AdvisorPriorityClientsProps {
  clients: PriorityClient[];
}

export default function AdvisorPriorityClients({
  clients,
}: AdvisorPriorityClientsProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Priority Follow-ups
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Clients requiring advisory attention based on Shield, stress, roadmap,
          and review signals.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No priority follow-ups at this time.
          </p>
        </div>
      ) : (
        <ul className="relative divide-y divide-[#D1A866]/8">
          {clients.map((client) => (
            <li key={client.clientId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-light text-[#F3F1EA]">
                    {client.displayName}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#F3F1EA]/40">
                    {client.status.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums text-[#D1A866]">
                    {client.adjustedShieldScore != null
                      ? formatScore(client.adjustedShieldScore)
                      : "—"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#F3F1EA]/50">
                    {client.rating ?? "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {client.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="inline-flex rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/55"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
