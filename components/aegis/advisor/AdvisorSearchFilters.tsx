"use client";

import type { ClientStatus } from "@/lib/supabase/userProfile";
import type { AdvisorRiskLevel } from "@/lib/supabase/advisorQueries";
import type { ShieldRating } from "@/src/lib/scoring/types";

export type AdvisorFilters = {
  search: string;
  status: ClientStatus | "all";
  rating: ShieldRating | "all";
  riskLevel: AdvisorRiskLevel | "all";
};

const STATUS_OPTIONS: Array<{ value: ClientStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "prospect", label: "Prospect" },
  { value: "review_due", label: "Review due" },
  { value: "archived", label: "Archived" },
];

const RATING_OPTIONS: Array<{ value: ShieldRating | "all"; label: string }> = [
  { value: "all", label: "All ratings" },
  { value: "AAA", label: "AAA" },
  { value: "AA", label: "AA" },
  { value: "A", label: "A" },
  { value: "BBB", label: "BBB" },
  { value: "BB", label: "BB" },
  { value: "B", label: "B" },
];

const RISK_OPTIONS: Array<{ value: AdvisorRiskLevel | "all"; label: string }> = [
  { value: "all", label: "All risk levels" },
  { value: "high", label: "High risk" },
  { value: "medium", label: "Medium risk" },
  { value: "low", label: "Low risk" },
];

interface AdvisorSearchFiltersProps {
  filters: AdvisorFilters;
  onChange: (filters: AdvisorFilters) => void;
  resultCount: number;
  totalCount: number;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/35"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AdvisorSearchFilters({
  filters,
  onChange,
  resultCount,
  totalCount,
}: AdvisorSearchFiltersProps) {
  return (
    <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Client Registry
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Showing {resultCount} of {totalCount} clients
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Search
          </span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
            placeholder="Name or email"
            className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/80 px-3 py-2 text-sm font-light text-[#F3F1EA] outline-none transition-colors placeholder:text-[#F3F1EA]/25 focus:border-[#D1A866]/35"
          />
        </label>

        <SelectField
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(status) => onChange({ ...filters, status })}
        />

        <SelectField
          label="Rating"
          value={filters.rating}
          options={RATING_OPTIONS}
          onChange={(rating) => onChange({ ...filters, rating })}
        />

        <SelectField
          label="Risk level"
          value={filters.riskLevel}
          options={RISK_OPTIONS}
          onChange={(riskLevel) => onChange({ ...filters, riskLevel })}
        />
      </div>
    </div>
  );
}
