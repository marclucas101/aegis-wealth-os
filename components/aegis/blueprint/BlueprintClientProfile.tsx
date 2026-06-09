"use client";

import { formatCurrency } from "@/components/aegis/ShieldScoreCard";
import type { DiscoverFormData } from "@/lib/aegis/localProfile";
import type { ClientProfile } from "@/src/lib/scoring/types";

interface BlueprintClientProfileProps {
  client: ClientProfile;
  formData: DiscoverFormData;
  completedAt: string;
}

function formatMaritalStatus(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export default function BlueprintClientProfile({
  client,
  formData,
  completedAt,
}: BlueprintClientProfileProps) {
  const { personal, family } = formData;
  const clientName =
    [personal.firstName, personal.lastName].filter(Boolean).join(" ") || "Client";
  const capturedDate = new Date(completedAt).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const profileRows: Array<{ label: string; value: string }> = [
    { label: "Client Name", value: clientName },
    { label: "Age", value: String(client.age) },
    { label: "Occupation", value: client.occupation || "—" },
    { label: "Residency", value: personal.residency || "—" },
    { label: "Marital Status", value: formatMaritalStatus(personal.maritalStatus) },
    {
      label: "Household",
      value: family.hasPartner
        ? `Partner${family.numberOfChildren ? ` · ${family.numberOfChildren} dependant(s)` : ""}`
        : family.numberOfChildren
          ? `${family.numberOfChildren} dependant(s)`
          : "Individual",
    },
    { label: "Annual Income", value: formatCurrency(client.income) },
    { label: "Net Worth", value: formatCurrency(client.netWorth) },
    {
      label: "Business Owner",
      value: client.isBusinessOwner ? "Yes" : "No",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Section 01
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Client Profile Summary
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Profile captured {capturedDate}
        </p>
      </div>

      <div className="grid gap-px bg-[#D1A866]/8 sm:grid-cols-2 lg:grid-cols-3">
        {profileRows.map((row) => (
          <div key={row.label} className="bg-[#10283A]/90 px-6 py-4">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
              {row.label}
            </p>
            <p className="mt-1.5 text-sm text-[#F3F1EA]">{row.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
