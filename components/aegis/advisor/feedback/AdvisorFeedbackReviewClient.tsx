"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AdvisorFeedbackListResponse } from "@/app/api/advisor/feedback/route";
import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import {
  FEEDBACK_STATUSES,
  type AdviserFeedbackRecord,
  type AdviserFeedbackSummary,
  type FeedbackStatus,
} from "@/lib/aegis/adviserFeedback";

type ReviewMode = "loading" | "ready" | "error" | "forbidden";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status: FeedbackStatus): string {
  switch (status) {
    case "approved_testimonial":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90";
    case "reviewed":
      return "border-[#D1A866]/35 bg-[#D1A866]/8 text-[#D1A866]/85";
    case "archived":
      return "border-[#F3F1EA]/10 bg-transparent text-[#F3F1EA]/35";
    default:
      return "border-[#F3F1EA]/15 bg-[#F3F1EA]/5 text-[#F3F1EA]/55";
  }
}

function testimonialLabel(item: AdviserFeedbackRecord): string {
  if (!item.permissionToUseAsTestimonial) return "No consent";
  if (item.testimonialAnonymous) return "Anonymous";
  return item.testimonialDisplayName ?? "Named";
}

export default function AdvisorFeedbackReviewClient() {
  const [mode, setMode] = useState<ReviewMode>("loading");
  const [feedback, setFeedback] = useState<AdviserFeedbackRecord[]>([]);
  const [summaries, setSummaries] = useState<AdviserFeedbackSummary[]>([]);
  const [viewerRole, setViewerRole] = useState<"advisor" | "admin">("advisor");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [minRating, setMinRating] = useState<number | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [adviserFilter, setAdviserFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeedback() {
      setMode("loading");

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (minRating !== "all") params.set("minRating", String(minRating));
      params.set("sort", sort);
      if (viewerRole === "admin" && adviserFilter !== "all") {
        params.set("adviserUserId", adviserFilter);
      }

      try {
        const response = await fetch(`/api/advisor/feedback?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as AdvisorFeedbackListResponse;

        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          setMode("forbidden");
          return;
        }

        if (!response.ok || !data.ok) {
          setMode("error");
          setError(data.ok ? "Failed to load feedback" : data.error ?? "Failed to load feedback");
          return;
        }

        setFeedback(data.feedback);
        setSummaries(data.summaries);
        setViewerRole(data.viewer.role);
        setMode("ready");
      } catch {
        if (!cancelled) {
          setMode("error");
          setError("Failed to load feedback");
        }
      }
    }

    void loadFeedback();

    return () => {
      cancelled = true;
    };
  }, [statusFilter, minRating, sort, adviserFilter, viewerRole]);

  const adviserOptions = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const item of feedback) {
      if (item.adviserUserId) {
        map.set(item.adviserUserId, item.adviserName);
      }
    }
    for (const summary of summaries) {
      map.set(summary.adviserUserId, summary.adviserName);
    }
    return [...map.entries()];
  }, [feedback, summaries]);

  async function updateFeedback(
    feedbackId: string,
    payload: { status?: FeedbackStatus; admin_notes?: string | null },
  ) {
    setUpdatingId(feedbackId);

    try {
      const response = await fetch(`/api/advisor/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as
        | { ok: true; feedback: AdviserFeedbackRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.ok ? "Failed to update feedback" : data.error ?? "Failed to update feedback");
        return;
      }

      setFeedback((current) =>
        current.map((item) => (item.id === feedbackId ? data.feedback : item)),
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (mode === "forbidden") {
    return <AdvisorAccessDenied />;
  }

  if (mode === "loading") {
    return (
      <div className="h-56 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40" />
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-500/5 p-6 text-sm font-light text-red-200/80">
        {error ?? "Unable to load feedback review."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1A866]/60">
            Advisor OS
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Review client feedback, quality signals, and testimonial-ready submissions.
          </p>
        </div>
        <Link
          href="/advisor"
          className="inline-flex rounded-sm border border-[#F3F1EA]/15 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition-colors hover:border-[#F3F1EA]/25"
        >
          Back to Advisor OS
        </Link>
      </div>

      {summaries.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary) => (
            <div
              key={summary.adviserUserId}
              className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/45 p-4"
            >
              <p className="text-sm font-light text-[#F3F1EA]">
                {summary.adviserName ?? "Adviser"}
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Average rating
                  </p>
                  <p className="font-mono text-2xl text-[#D1A866]">
                    {summary.averageOverallRating?.toFixed(1) ?? "—"}
                  </p>
                </div>
                <p className="text-xs font-light text-[#F3F1EA]/45">
                  {summary.feedbackCount} submission
                  {summary.feedbackCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as FeedbackStatus | "all")}
          options={[
            { value: "all", label: "All" },
            ...FEEDBACK_STATUSES.map((status) => ({ value: status, label: status })),
          ]}
        />
        <FilterSelect
          label="Min rating"
          value={String(minRating)}
          onChange={(value) =>
            setMinRating(value === "all" ? "all" : Number.parseInt(value, 10))
          }
          options={[
            { value: "all", label: "All" },
            ...[5, 4, 3, 2, 1].map((rating) => ({
              value: String(rating),
              label: `${rating}+`,
            })),
          ]}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(value) => setSort(value as "newest" | "oldest")}
          options={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
          ]}
        />
        {viewerRole === "admin" && adviserOptions.length > 1 && (
          <FilterSelect
            label="Adviser"
            value={adviserFilter}
            onChange={setAdviserFilter}
            options={[
              { value: "all", label: "All advisers" },
              ...adviserOptions.map(([id, name]) => ({
                value: id,
                label: name ?? id.slice(0, 8),
              })),
            ]}
          />
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-light text-red-200/80">
          {error}
        </div>
      )}

      {feedback.length === 0 ? (
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-5 py-8 text-sm font-light text-[#F3F1EA]/45">
          No feedback submissions match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => (
            <article
              key={item.id}
              className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/55 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-wider ${statusBadgeClass(item.status)}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-sm text-[#D1A866]">
                      {item.ratingOverall}/5
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-light text-[#F3F1EA]">
                    {item.clientDisplayName ?? "Client"}
                    {item.adviserName ? ` · ${item.adviserName}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-light text-[#F3F1EA]/40">
                    Testimonial: {testimonialLabel(item)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.status === "submitted" && (
                    <ActionButton
                      label="Mark reviewed"
                      disabled={updatingId === item.id}
                      onClick={() => updateFeedback(item.id, { status: "reviewed" })}
                    />
                  )}
                  {viewerRole === "admin" && item.permissionToUseAsTestimonial && (
                    <ActionButton
                      label="Approve testimonial"
                      disabled={
                        updatingId === item.id ||
                        item.status === "approved_testimonial"
                      }
                      onClick={() =>
                        updateFeedback(item.id, { status: "approved_testimonial" })
                      }
                    />
                  )}
                  {viewerRole === "admin" && item.status !== "archived" && (
                    <ActionButton
                      label="Archive"
                      disabled={updatingId === item.id}
                      onClick={() => updateFeedback(item.id, { status: "archived" })}
                    />
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm font-light text-[#F3F1EA]/60 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Clarity" value={item.ratingClarity} />
                <Metric label="Responsiveness" value={item.ratingResponsiveness} />
                <Metric label="Trust" value={item.ratingTrust} />
                <Metric label="Professionalism" value={item.ratingProfessionalism} />
              </div>

              {item.whatWentWell && (
                <FeedbackBlock label="What went well" text={item.whatWentWell} />
              )}
              {item.whatCouldImprove && (
                <FeedbackBlock
                  label="What could improve"
                  text={item.whatCouldImprove}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-2 py-1.5 text-[10px] text-[#F3F1EA]"
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

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-sm border border-[#D1A866]/25 px-2 py-1 text-[9px] uppercase tracking-wider text-[#D1A866]/80 hover:border-[#D1A866]/40 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-[#F3F1EA]/75">{value ?? "—"}</p>
    </div>
  );
}

function FeedbackBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4 border-t border-[#D1A866]/8 pt-4">
      <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">{label}</p>
      <p className="mt-1 text-sm font-light leading-relaxed text-[#F3F1EA]/60">
        {text}
      </p>
    </div>
  );
}
