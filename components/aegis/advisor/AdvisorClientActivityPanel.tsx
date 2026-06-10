"use client";

import type { AdvisorActivityItem } from "@/lib/supabase/advisorQueries";

interface AdvisorClientActivityPanelProps {
  activity: AdvisorActivityItem[];
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdvisorClientActivityPanel({
  activity,
}: AdvisorClientActivityPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Recent Activity
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Audit trail for this client
        </p>
      </div>

      {activity.length === 0 ? (
        <div className="relative px-5 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D1A866]/15 bg-[#071B2A]/50">
            <span className="text-lg text-[#D1A866]/40" aria-hidden>
              ◇
            </span>
          </div>
          <p className="text-sm font-light text-[#F3F1EA]/50">
            No recent activity recorded for this client.
          </p>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
            Client portal actions, document uploads, and review events will
            appear in the audit trail here.
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
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                    {item.entityType.replace(/_/g, " ")}
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
