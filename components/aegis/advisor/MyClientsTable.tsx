"use client";

import Link from "next/link";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { MyClientsListItem } from "@/lib/aegis/myClients";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

interface MyClientsTableProps {
  clients: MyClientsListItem[];
}

export default function MyClientsTable({ clients }: MyClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No clients match the current search.
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
                "Onboarding",
                "Shield",
                "Review",
                "Last activity",
                "Appointment",
                "Docs",
                "Budget",
                "Feedback",
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
                  <Link href={`/advisor/clients/${client.id}`} className="group block">
                    <p className="text-sm font-light text-[#F3F1EA] group-hover:text-[#D1A866]">
                      {client.displayName}
                    </p>
                    <p className="mt-0.5 text-xs text-[#F3F1EA]/40">
                      {client.email ?? "—"}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/70">
                  {statusLabel(client.status)}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {client.onboardingStep?.replace(/_/g, " ") ?? "—"}
                </td>
                <td className="px-4 py-4 font-mono text-sm text-[#D1A866]">
                  {client.adjustedShieldScore != null
                    ? formatScore(client.adjustedShieldScore)
                    : "—"}
                  {client.rating ? ` · ${client.rating}` : ""}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {client.reviewDue ? (
                    <span className="text-amber-200">Due</span>
                  ) : client.nextReviewDue ? (
                    formatDate(client.nextReviewDue)
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {formatDate(client.lastActivityDate)}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {formatDateTime(client.upcomingAppointmentAt)}
                </td>
                <td className="px-4 py-4 font-mono text-sm text-[#F3F1EA]/70">
                  {client.documentCount}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {client.budgetSaved ? "Saved" : "—"}
                </td>
                <td className="px-4 py-4 text-sm text-[#F3F1EA]/55">
                  {client.feedbackStatus?.replace(/_/g, " ") ?? "—"}
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/advisor/clients/${client.id}`}
                    className="inline-flex rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]"
                  >
                    Open
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
            <p className="text-sm font-light text-[#F3F1EA]">{client.displayName}</p>
            <p className="mt-1 text-xs text-[#F3F1EA]/40">{client.email ?? "—"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#F3F1EA]/55">
              <span>Shield: {client.adjustedShieldScore ?? "—"}</span>
              <span>Docs: {client.documentCount}</span>
              <span>Budget: {client.budgetSaved ? "Saved" : "—"}</span>
              <span>Feedback: {client.feedbackStatus ?? "—"}</span>
            </div>
            <Link
              href={`/advisor/clients/${client.id}`}
              className="mt-3 inline-flex text-[10px] uppercase tracking-[0.14em] text-[#D1A866]"
            >
              Open workspace
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
