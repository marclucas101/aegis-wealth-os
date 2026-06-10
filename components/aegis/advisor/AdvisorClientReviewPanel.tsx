"use client";

import { useEffect, useState } from "react";

import AdvisorReviewStatusBadge from "@/components/aegis/advisor/AdvisorReviewStatusBadge";
import type { ClientReviewStatusDetail } from "@/lib/supabase/advisorReviewPipeline";

const MANUAL_REVIEW_STATUSES = [
  "onboarding",
  "active",
  "review_due",
  "archived",
] as const;

type ManualReviewStatus = (typeof MANUAL_REVIEW_STATUSES)[number];

interface AdvisorClientReviewPanelProps {
  clientId: string;
  review: ClientReviewStatusDetail | null;
  error: string | null;
  onRetry?: () => void;
  onStatusUpdated?: (newStatus: ManualReviewStatus) => void;
  onReviewRefreshed?: (review: ClientReviewStatusDetail) => void;
}

const MANUAL_STATUS_LABELS: Record<ManualReviewStatus, string> = {
  onboarding: "Onboarding",
  active: "Active",
  review_due: "Review Due",
  archived: "Archived",
};

function formatReviewDate(isoDate: string | null): string {
  if (!isoDate) return "Not on file";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Not on file";

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function resolveManualStatus(
  review: ClientReviewStatusDetail,
): ManualReviewStatus {
  if (
    MANUAL_REVIEW_STATUSES.includes(review.dbStatus as ManualReviewStatus)
  ) {
    return review.dbStatus as ManualReviewStatus;
  }

  if (review.dbStatus === "prospect") {
    return "onboarding";
  }

  return "active";
}

export default function AdvisorClientReviewPanel({
  clientId,
  review: initialReview,
  error,
  onRetry,
  onStatusUpdated,
  onReviewRefreshed,
}: AdvisorClientReviewPanelProps) {
  const [review, setReview] = useState<ClientReviewStatusDetail | null>(
    initialReview,
  );
  const [selectedStatus, setSelectedStatus] = useState<ManualReviewStatus>(
    "active",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isLoading = initialReview === null && error === null;

  useEffect(() => {
    setReview(initialReview);
    if (initialReview) {
      setSelectedStatus(resolveManualStatus(initialReview));
    }
  }, [initialReview]);

  async function handleStatusUpdate() {
    if (!review || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/review-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: selectedStatus }),
        },
      );

      const data = (await response.json()) as
        | { ok: true; newStatus: ManualReviewStatus }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setSaveError(
          "error" in data && data.error
            ? data.error
            : "Failed to update review status.",
        );
        return;
      }

      setSaveMessage("Review status updated.");
      onStatusUpdated?.(data.newStatus);

      const refreshResponse = await fetch(
        `/api/advisor/clients/${clientId}/review-status`,
        { cache: "no-store" },
      );

      if (refreshResponse.ok) {
        const refreshData = (await refreshResponse.json()) as
          | { ok: true; review: ClientReviewStatusDetail }
          | { ok: false };

        if (refreshData.ok) {
          setReview(refreshData.review);
          setSelectedStatus(resolveManualStatus(refreshData.review));
          onReviewRefreshed?.(refreshData.review);
        }
      }
    } catch {
      setSaveError("Failed to update review status.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-10 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Loading review status…
        </p>
      </section>
    );
  }

  if (error || !review) {
    return (
      <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          {error ?? "Unable to load review status."}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
          >
            Retry
          </button>
        ) : null}
      </section>
    );
  }

  const canUpdateStatus = review.dbStatus !== "archived";

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Review Status
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Servicing state, review cycle, and manual status controls.
        </p>
      </div>

      <div className="relative space-y-0 px-5 py-2">
        <div className="flex flex-col gap-2 border-b border-[#D1A866]/8 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
            Servicing state
          </span>
          <AdvisorReviewStatusBadge state={review.servicingState} />
        </div>

        <div className="flex flex-col gap-1 border-b border-[#D1A866]/8 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
            Last annual review
          </span>
          <span className="text-sm font-light text-[#F3F1EA]/85">
            {formatReviewDate(review.lastAnnualReviewDate)}
          </span>
        </div>

        <div className="flex flex-col gap-1 border-b border-[#D1A866]/8 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
            Next recommended review
          </span>
          <span className="text-sm font-light text-[#F3F1EA]/85">
            {formatReviewDate(review.nextRecommendedReviewDate)}
          </span>
        </div>

        <div className="border-b border-[#D1A866]/8 py-4">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
            Recommended action
          </span>
          <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/65">
            {review.recommendedNextAction}
          </p>
        </div>

        {review.priorityReasons.length > 0 && (
          <div className="border-b border-[#D1A866]/8 py-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
              Priority reasons
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {review.priorityReasons.map((reason) => (
                <span
                  key={reason}
                  className="inline-flex rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/55"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {canUpdateStatus && (
          <div className="py-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3F1EA]/40">
              Manual status update
            </span>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="sr-only">Client status</span>
                <select
                  value={selectedStatus}
                  onChange={(event) =>
                    setSelectedStatus(event.target.value as ManualReviewStatus)
                  }
                  disabled={isSaving}
                  className="w-full rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/60 px-3 py-2 text-sm font-light text-[#F3F1EA]/85 outline-none focus:border-[#D1A866]/40 disabled:opacity-50"
                >
                  {MANUAL_REVIEW_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {MANUAL_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleStatusUpdate()}
                disabled={isSaving || selectedStatus === review.dbStatus}
                className="shrink-0 rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:border-[#D1A866]/50 hover:bg-[#D1A866]/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving ? "Saving…" : "Update status"}
              </button>
            </div>
            {saveMessage && (
              <p className="mt-2 text-xs font-light text-emerald-300/80">
                {saveMessage}
              </p>
            )}
            {saveError && (
              <p className="mt-2 text-xs font-light text-red-300/80">
                {saveError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
