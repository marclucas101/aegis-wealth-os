"use client";

import type { AdvisorAnnualReviewEntry } from "@/lib/supabase/advisorClientQueries";
import type { AdvisorActivityItem } from "@/lib/supabase/advisorQueries";
import type { AdvisorClientRecord } from "@/lib/supabase/advisorClientQueries";

interface AdvisorClientTimelineProps {
  client: AdvisorClientRecord;
  recentActivity: AdvisorActivityItem[];
  lastAnnualReview: AdvisorAnnualReviewEntry | null;
}

type TimelineEvent = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
};

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildTimelineEvents(
  client: AdvisorClientRecord,
  recentActivity: AdvisorActivityItem[],
  lastAnnualReview: AdvisorAnnualReviewEntry | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (lastAnnualReview) {
    events.push({
      id: `review-${lastAnnualReview.id}`,
      label: "Annual review",
      detail:
        lastAnnualReview.reviewLabel ??
        `${lastAnnualReview.reviewYear} review · ${lastAnnualReview.rating}`,
      timestamp: lastAnnualReview.generatedAt,
    });
  } else if (client.lastReviewAt) {
    events.push({
      id: "last-review",
      label: "Last review",
      detail: "Recorded on client profile",
      timestamp: client.lastReviewAt,
    });
  }

  for (const item of recentActivity.slice(0, 4)) {
    events.push({
      id: item.id,
      label: item.summary,
      detail: item.entityType.replace(/_/g, " "),
      timestamp: item.createdAt,
    });
  }

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return events.slice(0, 5);
}

export default function AdvisorClientTimeline({
  client,
  recentActivity,
  lastAnnualReview,
}: AdvisorClientTimelineProps) {
  const events = buildTimelineEvents(
    client,
    recentActivity,
    lastAnnualReview,
  );

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/35">
      <div className="relative border-b border-[#D1A866]/8 px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
          Recent Milestones
        </p>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/40">
            No milestones recorded yet for this client file.
          </p>
        </div>
      ) : (
        <ol className="relative divide-y divide-[#D1A866]/8">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start justify-between gap-4 px-5 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-light text-[#F3F1EA]/85">
                  {event.label}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                  {event.detail}
                </p>
              </div>
              <time
                dateTime={event.timestamp}
                className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-[#D1A866]/60"
              >
                {formatEventDate(event.timestamp)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
