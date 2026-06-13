"use client";

import { useEffect, useState } from "react";

type FeedbackItem = {
  id: string;
  status: string;
  ratingOverall: number;
  createdAt: string;
  updatedAt: string;
  permissionToUseAsTestimonial: boolean;
  testimonialAnonymous: boolean;
};

type FeedbackResponse =
  | {
      ok: true;
      feedback: FeedbackItem[];
      latestStatus: string | null;
      hasFeedback: boolean;
    }
  | { ok: false; error?: string };

export default function AdvisorClientFeedbackPanel({
  clientId,
}: {
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [latestStatus, setLatestStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/feedback`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as FeedbackResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setError(
            payload.ok ? "Failed to load feedback" : payload.error ?? "Failed to load feedback",
          );
          return;
        }

        setFeedback(payload.feedback);
        setLatestStatus(payload.latestStatus);
      } catch {
        if (!cancelled) {
          setError("Failed to load feedback");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
        {error}
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No adviser feedback submitted for this client yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {latestStatus && (
        <p className="text-sm text-[#F3F1EA]/55">
          Latest status:{" "}
          <span className="text-[#D1A866]">
            {latestStatus.replace(/_/g, " ")}
          </span>
        </p>
      )}

      {feedback.map((item) => (
        <article
          key={item.id}
          className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] uppercase tracking-wider text-[#D1A866]/60">
              {item.status.replace(/_/g, " ")}
            </p>
            <p className="font-mono text-sm text-[#D1A866]">
              {item.ratingOverall}/5
            </p>
          </div>
          <p className="mt-2 text-sm text-[#F3F1EA]/45">
            Submitted {new Date(item.createdAt).toLocaleDateString("en-SG")}
          </p>
          {item.permissionToUseAsTestimonial && (
            <p className="mt-1 text-xs text-[#F3F1EA]/35">
              Testimonial permission granted
              {item.testimonialAnonymous ? " (anonymous)" : ""}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
