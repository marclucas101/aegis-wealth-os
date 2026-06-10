"use client";

import Link from "next/link";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AdvisorClientRow } from "@/lib/supabase/advisorQueries";

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: AdvisorClientRow["status"]): string {
  return status.replace(/_/g, " ");
}

function statusStyles(status: AdvisorClientRow["status"]): string {
  switch (status) {
    case "active":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "onboarding":
      return "border-[#D1A866]/30 bg-[#D1A866]/10 text-[#D1A866]/90";
    case "prospect":
      return "border-[#F3F1EA]/15 bg-[#F3F1EA]/5 text-[#F3F1EA]/60";
    case "review_due":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "archived":
      return "border-[#F3F1EA]/10 bg-[#071B2A]/50 text-[#F3F1EA]/35";
    default:
      return "border-[#F3F1EA]/12 bg-[#071B2A]/40 text-[#F3F1EA]/50";
  }
}

function riskStyles(riskLevel: AdvisorClientRow["riskLevel"]): string {
  switch (riskLevel) {
    case "high":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "medium":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }
}

interface AdvisorClientTableProps {
  clients: AdvisorClientRow[];
}

export default function AdvisorClientTable({ clients }: AdvisorClientTableProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No clients match the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50">
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[#D1A866]/8 text-left">
              {[
                "Client",
                "Status",
                "Shield",
                "Rating",
                "Discover",
                "DCF",
                "Roadmap",
                "Docs",
                "Last activity",
                "Risk",
                "",
              ].map((heading) => (
                <th
                  key={heading || "action"}
                  className="px-4 py-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/35"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D1A866]/8">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="transition-colors hover:bg-[#1A2A2B]/30"
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/advisor/clients/${client.id}`}
                    className="group block"
                  >
                    <p className="text-sm font-light text-[#F3F1EA] transition-colors group-hover:text-[#D1A866]">
                      {client.displayName}
                    </p>
                    <p className="mt-0.5 text-xs text-[#F3F1EA]/40">
                      {client.email ?? "—"}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${statusStyles(client.status)}`}
                  >
                    {statusLabel(client.status)}
                  </span>
                </td>
                <td className="px-4 py-4 font-mono text-sm tabular-nums text-[#D1A866]">
                  {client.adjustedShieldScore != null
                    ? formatScore(client.adjustedShieldScore)
                    : "—"}
                </td>
                <td className="px-4 py-4 font-mono text-sm text-[#F3F1EA]">
                  {client.rating ?? "—"}
                </td>
                <td className="px-4 py-4 font-mono text-sm tabular-nums text-[#F3F1EA]/75">
                  {client.discoverScore != null
                    ? formatScore(client.discoverScore)
                    : "—"}
                </td>
                <td className="px-4 py-4 font-mono text-sm tabular-nums text-[#F3F1EA]/75">
                  {formatPercent(client.dataConfidenceFactor)}
                </td>
                <td className="px-4 py-4 font-mono text-sm tabular-nums text-[#F3F1EA]/75">
                  {client.roadmapCompletionPercent}%
                </td>
                <td className="px-4 py-4 font-mono text-sm tabular-nums text-[#F3F1EA]/75">
                  {client.documentCount}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {formatDate(client.lastActivityDate)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${riskStyles(client.riskLevel)}`}
                  >
                    {client.riskLevel}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/advisor/clients/${client.id}`}
                    className="inline-flex rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/18"
                  >
                    Open workspace
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-[#D1A866]/8 lg:hidden">
        {clients.map((client) => (
          <li key={client.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-light text-[#F3F1EA]">
                  {client.displayName}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#F3F1EA]/40">
                  {client.email ?? "—"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${riskStyles(client.riskLevel)}`}
              >
                {client.riskLevel}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-sm border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${statusStyles(client.status)}`}
              >
                {statusLabel(client.status)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#F3F1EA]/35">Shield</p>
                <p className="mt-0.5 font-mono text-[#D1A866]">
                  {client.adjustedShieldScore != null
                    ? formatScore(client.adjustedShieldScore)
                    : "—"}{" "}
                  {client.rating ? `· ${client.rating}` : ""}
                </p>
              </div>
              <div>
                <p className="text-[#F3F1EA]/35">Roadmap</p>
                <p className="mt-0.5 font-mono text-[#F3F1EA]/70">
                  {client.roadmapCompletionPercent}%
                </p>
              </div>
              <div>
                <p className="text-[#F3F1EA]/35">Last activity</p>
                <p className="mt-0.5 text-[#F3F1EA]/60">
                  {formatDate(client.lastActivityDate)}
                </p>
              </div>
            </div>

            <Link
              href={`/advisor/clients/${client.id}`}
              className="mt-4 inline-flex rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/18"
            >
              Open workspace
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
