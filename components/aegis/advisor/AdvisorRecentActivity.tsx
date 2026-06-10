"use client";

import type { AdvisorActivityItem } from "@/lib/supabase/advisorQueries";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AdvisorRecentActivityProps {
  activity: AdvisorActivityItem[];
}

export default function AdvisorRecentActivity({
  activity,
}: AdvisorRecentActivityProps) {
  return (
    <section
      id="advisor-activity"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Recent Activity
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Latest client events from the audit trail.
        </p>
      </div>

      {activity.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No recent activity recorded yet.
          </p>
        </div>
      ) : (
        <ul className="relative divide-y divide-[#D1A866]/8">
          {activity.map((item) => (
            <li key={item.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-light text-[#F3F1EA]">
                    {item.summary}
                  </p>
                  <p className="mt-1 text-xs text-[#F3F1EA]/40">
                    {item.clientDisplayName ?? "Unknown client"}
                  </p>
                </div>
                <time
                  dateTime={item.createdAt}
                  className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35"
                >
                  {formatTimestamp(item.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
