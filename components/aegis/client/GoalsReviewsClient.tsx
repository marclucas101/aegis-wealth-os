"use client";

import { useEffect, useState } from "react";

import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import type { ClientSafePublishedSummary } from "@/lib/compliance/clientSafeDtos";
import type { ClientGoalRecord } from "@/lib/supabase/clientGoalsPersistence";
import { CLIENT_TERMINOLOGY } from "@/lib/compliance/terminology";

type GoalsReviewsData = {
  goals: ClientGoalRecord[];
  reviewStatus: { pending: boolean; submissionType: string | null };
  publishedSummaries: ClientSafePublishedSummary[];
};

export default function GoalsReviewsClient() {
  const [data, setData] = useState<GoalsReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalTitle, setGoalTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const response = await fetch("/api/client/goals-reviews", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data?: GoalsReviewsData };
    if (payload.ok && payload.data) {
      setData(payload.data);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/client/goals-reviews", { cache: "no-store" });
        const payload = (await response.json()) as { ok: boolean; data?: GoalsReviewsData };
        if (!cancelled && payload.ok && payload.data) {
          setData(payload.data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!goalTitle.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/client/goals-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_goal", title: goalTitle.trim() }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (result.ok) {
        setGoalTitle("");
        setMessage("Goal saved for your records. Your adviser will review as needed.");
        await reload();
      } else {
        setMessage(result.error ?? "Unable to save goal");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReview() {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/client/goals-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_review",
          submissionType: "annual_review",
          payload: { submittedAt: new Date().toISOString() },
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        result?: { alreadySubmitted: boolean };
        error?: string;
      };
      if (result.ok) {
        setMessage(
          result.result?.alreadySubmitted
            ? "Your review information is already with your adviser."
            : "Information submitted. Your adviser will review and follow up.",
        );
        await reload();
      } else {
        setMessage(result.error ?? "Unable to submit");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center text-sm text-[#F3F1EA]/40">
        Loading goals and reviews…
      </div>
    );
  }

  return (
    <>
      <ClientPortalHeader
        eyebrow={CLIENT_TERMINOLOGY.goalsAndReviews}
        title="Goals and review information"
        subtitle="Record your priorities and submit information for adviser review — not automated advice."
      />

      {message ? (
        <p className="mb-6 rounded-sm border border-[#D1A866]/20 bg-[#10283A]/40 px-4 py-3 text-sm text-[#F3F1EA]/75">
          {message}
        </p>
      ) : null}

      {data?.reviewStatus.pending ? (
        <div className="mb-6 rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/5 px-4 py-3 text-sm text-[#F3F1EA]/75">
          Your submitted information is pending adviser review.
        </div>
      ) : null}

      <section className="mb-8 rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-5">
        <h2 className="text-sm font-medium text-[#F3F1EA]/85">Your goals</h2>
        <form onSubmit={saveGoal} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="goal-title" className="sr-only">
            Goal title
          </label>
          <input
            id="goal-title"
            type="text"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="Describe a financial goal"
            className="flex-1 rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-sm border border-[#D1A866]/35 px-4 py-2 text-sm text-[#D1A866] disabled:opacity-50"
          >
            Add goal
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {(data?.goals ?? []).map((goal) => (
            <li
              key={goal.id}
              className="rounded-sm border border-[#D1A866]/10 px-3 py-2 text-sm text-[#F3F1EA]/70"
            >
              {goal.title}
              <span className="ml-2 text-xs text-[#F3F1EA]/35">({goal.priority})</span>
            </li>
          ))}
          {(data?.goals ?? []).length === 0 ? (
            <li className="text-sm text-[#F3F1EA]/40">No goals recorded yet.</li>
          ) : null}
        </ul>
      </section>

      <section className="mb-8 rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-5">
        <h2 className="text-sm font-medium text-[#F3F1EA]/85">Review preparation</h2>
        <p className="mt-2 text-sm text-[#F3F1EA]/55">
          Submit updated information for your adviser to review. This does not generate
          product or investment recommendations.
        </p>
        <button
          type="button"
          onClick={() => void submitReview()}
          disabled={submitting}
          className="mt-4 rounded-sm border border-[#D1A866]/35 px-4 py-2 text-sm text-[#D1A866] disabled:opacity-50"
        >
          Submit for adviser review
        </button>
      </section>

      {(data?.publishedSummaries ?? []).length > 0 ? (
        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-5 py-5">
          <h2 className="text-sm font-medium text-[#F3F1EA]/85">
            {CLIENT_TERMINOLOGY.adviserReviewedSummary}
          </h2>
          <ul className="mt-4 space-y-3">
            {data?.publishedSummaries.map((summary) => (
              <li key={summary.id} className="text-sm text-[#F3F1EA]/70">
                {summary.title}
                {summary.dataAsAt
                  ? ` · ${CLIENT_TERMINOLOGY.dataAsAt(summary.dataAsAt)}`
                  : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8">
        <ClientTrustNotice />
      </div>
    </>
  );
}
