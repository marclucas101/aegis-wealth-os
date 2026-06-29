"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { AdvisorV2RelationshipsListResponse } from "@/app/api/advisor-v2/relationships/route";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import type { CrmRelationshipListItem, CrmRelationshipListPage } from "@/lib/crm-v2/relationships/types";
import type { ClientStatus, RelationshipStage } from "@/lib/supabase/userProfile";

const STATUS_OPTIONS: Array<{ value: ClientStatus | "all"; label: string }> = [
  { value: "all", label: "All servicing states" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "prospect", label: "Prospect" },
  { value: "review_due", label: "Review due" },
  { value: "archived", label: "Archived" },
];

const STAGE_OPTIONS: Array<{ value: RelationshipStage | "all"; label: string }> = [
  { value: "all", label: "All stages" },
  { value: "prospect", label: "Prospect" },
  { value: "fact_find_complete", label: "Fact-find complete" },
  { value: "adviser_review", label: "Adviser review" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "recommendation_prepared", label: "Recommendation prepared" },
  { value: "active_client", label: "Active client" },
  { value: "inactive_client", label: "Inactive client" },
];

interface RelationshipListClientProps {
  initialPage: CrmRelationshipListPage;
}

export default function RelationshipListClient({ initialPage }: RelationshipListClientProps) {
  const [relationships, setRelationships] = useState<CrmRelationshipListItem[]>(
    initialPage.relationships,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState(initialPage.partialDataWarning);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [stage, setStage] = useState<RelationshipStage | "all">("all");
  const [reviewStatus, setReviewStatus] = useState<"all" | "due" | "current">("all");
  const [hasUpcomingAppointment, setHasUpcomingAppointment] = useState(false);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [page, setPage] = useState(initialPage.page);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [totalCount, setTotalCount] = useState(initialPage.totalCount);

  const loadRelationships = useCallback(
    async (overrides?: {
      page?: number;
      q?: string;
      status?: ClientStatus | "all";
      stage?: RelationshipStage | "all";
      reviewStatus?: "all" | "due" | "current";
      hasUpcomingAppointment?: boolean;
      needsAttention?: boolean;
    }) => {
      const nextPage = overrides?.page ?? page;
      const nextSearch = overrides?.q ?? search;
      const nextStatus = overrides?.status ?? status;
      const nextStage = overrides?.stage ?? stage;
      const nextReviewStatus = overrides?.reviewStatus ?? reviewStatus;
      const nextHasAppointment =
        overrides?.hasUpcomingAppointment ?? hasUpcomingAppointment;
      const nextNeedsAttention = overrides?.needsAttention ?? needsAttention;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: "20",
        });
        if (nextSearch.trim()) params.set("q", nextSearch.trim());
        if (nextStatus !== "all") params.set("status", nextStatus);
        if (nextStage !== "all") params.set("stage", nextStage);
        if (nextReviewStatus !== "all") params.set("reviewStatus", nextReviewStatus);
        if (nextHasAppointment) params.set("hasUpcomingAppointment", "true");
        if (nextNeedsAttention) params.set("needsAttention", "true");

        const response = await fetch(`/api/advisor-v2/relationships?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as AdvisorV2RelationshipsListResponse;

        if (!response.ok || !payload.ok) {
          setError(
            payload.ok ? "Failed to load relationships" : "Relationships unavailable",
          );
          return;
        }

        setRelationships(payload.relationships);
        setTotalPages(payload.totalPages);
        setTotalCount(payload.totalCount);
        setPartialWarning(payload.partialDataWarning);
        setPage(payload.page);
      } catch {
        setError("Failed to load relationships");
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      search,
      status,
      stage,
      reviewStatus,
      hasUpcomingAppointment,
      needsAttention,
    ],
  );

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadRelationships({ page: 1, q: search });
  }

  return (
    <div className="space-y-6">
      <CrmV2PageHeader
        title="Relationships"
        subtitle="Assigned relationship book — read-first workspace"
      />

      <form
        onSubmit={handleSearchSubmit}
        className="grid gap-4 rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50 p-4 lg:grid-cols-2 xl:grid-cols-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Search display name
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client name"
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Servicing state
          </span>
          <select
            value={status}
            onChange={(e) => {
              const nextStatus = e.target.value as ClientStatus | "all";
              setStatus(nextStatus);
              setPage(1);
              void loadRelationships({ page: 1, status: nextStatus });
            }}
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Relationship stage
          </span>
          <select
            value={stage}
            onChange={(e) => {
              const nextStage = e.target.value as RelationshipStage | "all";
              setStage(nextStage);
              setPage(1);
              void loadRelationships({ page: 1, stage: nextStage });
            }}
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/35">
            Review status
          </span>
          <select
            value={reviewStatus}
            onChange={(e) => {
              const nextReview = e.target.value as "all" | "due" | "current";
              setReviewStatus(nextReview);
              setPage(1);
              void loadRelationships({ page: 1, reviewStatus: nextReview });
            }}
            className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A] px-3 py-2 text-sm text-[#F3F1EA]"
          >
            <option value="all">All reviews</option>
            <option value="due">Review due</option>
            <option value="current">Review current</option>
          </select>
        </label>

        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-[#F3F1EA]/70">
            <input
              type="checkbox"
              checked={hasUpcomingAppointment}
              onChange={(e) => {
                const next = e.target.checked;
                setHasUpcomingAppointment(next);
                setPage(1);
                void loadRelationships({ page: 1, hasUpcomingAppointment: next });
              }}
            />
            Has upcoming appointment
          </label>
          <label className="flex items-center gap-2 text-sm text-[#F3F1EA]/70">
            <input
              type="checkbox"
              checked={needsAttention}
              onChange={(e) => {
                const next = e.target.checked;
                setNeedsAttention(next);
                setPage(1);
                void loadRelationships({ page: 1, needsAttention: next });
              }}
            />
            Needs attention
          </label>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-4 py-2 text-sm text-[#F3F1EA] hover:bg-[#D1A866]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
          >
            Apply filters
          </button>
        </div>
      </form>

      <p className="text-xs text-[#F3F1EA]/40">
        Showing {relationships.length} of {totalCount} assigned relationships
      </p>

      {partialWarning ? (
        <div
          role="status"
          className="rounded-sm border border-amber-400/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/85"
        >
          Some relationship data could not be loaded. Displayed values may be incomplete.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-sm border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          className="h-48 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30"
          aria-busy="true"
          aria-label="Loading relationships"
        />
      ) : relationships.length === 0 ? (
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-6 py-10 text-center">
          <h2 className="text-sm font-light text-[#F3F1EA]">
            {totalCount === 0 ? "No assigned relationships" : "No matching relationships"}
          </h2>
          <p className="mt-2 text-xs text-[#F3F1EA]/45">
            {totalCount === 0
              ? "Your authorized book is empty or filters exclude all records."
              : "Try adjusting search or filters within your assigned book."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-sm border border-[#D1A866]/12 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#D1A866]/10 bg-[#10283A]/60 text-[9px] uppercase tracking-[0.16em] text-[#F3F1EA]/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Servicing</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Last engagement</th>
                  <th className="px-4 py-3 font-medium">Next appointment</th>
                  <th className="px-4 py-3 font-medium">Review</th>
                  <th className="px-4 py-3 font-medium">Open actions</th>
                  <th className="px-4 py-3 font-medium">Data readiness</th>
                </tr>
              </thead>
              <tbody>
                {relationships.map((item) => (
                  <tr
                    key={item.relationshipId}
                    className="border-b border-[#D1A866]/8 hover:bg-[#10283A]/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={item.detailHref}
                        className="text-[#F3F1EA] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
                      >
                        {item.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.servicingStateLabel}</td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.relationshipStageLabel}</td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.lastEngagementLabel}</td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.nextAppointmentLabel}</td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.reviewStatusLabel}</td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.openActionsLabel}</td>
                    <td className="px-4 py-3 text-[#F3F1EA]/70">{item.dataReadinessLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {relationships.map((item) => (
              <article
                key={item.relationshipId}
                className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 p-4"
              >
                <h2 className="text-sm font-light text-[#F3F1EA]">
                  <Link
                    href={item.detailHref}
                    className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D1A866]/60"
                  >
                    {item.displayName}
                  </Link>
                </h2>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#F3F1EA]/60">
                  <div>
                    <dt>Servicing</dt>
                    <dd className="text-[#F3F1EA]/85">{item.servicingStateLabel}</dd>
                  </div>
                  <div>
                    <dt>Review</dt>
                    <dd className="text-[#F3F1EA]/85">{item.reviewStatusLabel}</dd>
                  </div>
                  <div>
                    <dt>Next appointment</dt>
                    <dd className="text-[#F3F1EA]/85">{item.nextAppointmentLabel}</dd>
                  </div>
                  <div>
                    <dt>Open actions</dt>
                    <dd className="text-[#F3F1EA]/85">{item.openActionsLabel}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label="Relationship list pagination"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const nextPage = Math.max(1, page - 1);
              setPage(nextPage);
              void loadRelationships({ page: nextPage });
            }}
            className="rounded-sm border border-[#D1A866]/25 px-3 py-2 text-sm text-[#F3F1EA]/80 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-[#F3F1EA]/45">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              const nextPage = Math.min(totalPages, page + 1);
              setPage(nextPage);
              void loadRelationships({ page: nextPage });
            }}
            className="rounded-sm border border-[#D1A866]/25 px-3 py-2 text-sm text-[#F3F1EA]/80 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
