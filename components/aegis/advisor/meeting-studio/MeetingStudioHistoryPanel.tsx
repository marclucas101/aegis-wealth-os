"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { MeetingSessionRow } from "@/lib/supabase/meetingSessionPersistence";

interface MeetingStudioHistoryPanelProps {
  clientId: string;
}

export default function MeetingStudioHistoryPanel({
  clientId,
}: MeetingStudioHistoryPanelProps) {
  const [sessions, setSessions] = useState<MeetingSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/meeting-sessions`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as {
          ok: boolean;
          sessions?: MeetingSessionRow[];
        };
        if (!cancelled && data.ok && data.sessions) {
          setSessions(data.sessions);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const activeSession = sessions.find(
    (s) => s.status === "prepared" || s.status === "in_progress",
  );
  const completedSessions = sessions.filter((s) => s.status === "completed");

  return (
    <section
      id="client-meeting-studio"
      aria-label="Meeting Studio"
      className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
        Meeting Studio
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/advisor/clients/${clientId}/meeting-studio`}
          className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300"
        >
          Start Meeting Studio
        </Link>
        {activeSession ? (
          <Link
            href={`/advisor/clients/${clientId}/meeting-studio?sessionId=${activeSession.id}`}
            className="rounded-sm border border-[#D1A866]/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/60"
          >
            {activeSession.status === "in_progress"
              ? "Resume meeting in progress"
              : "Resume prepared meeting"}
          </Link>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[#F3F1EA]/40">Loading meeting history…</p>
      ) : completedSessions.length > 0 ? (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
            Completed meetings
          </p>
          <ul className="mt-2 divide-y divide-[#D1A866]/10">
            {completedSessions.slice(0, 5).map((session) => (
              <li key={session.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-[#F3F1EA]/80">
                    {session.title ?? session.meeting_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-[#F3F1EA]/40">
                    {session.completed_at
                      ? new Date(session.completed_at).toLocaleDateString()
                      : "—"}{" "}
                    · {session.sections_shown.length} sections shown ·{" "}
                    {session.summary_status}
                  </p>
                </div>
                <Link
                  href={`/advisor/clients/${clientId}/meeting-studio?sessionId=${session.id}&stage=close`}
                  className="text-[10px] uppercase tracking-[0.12em] text-[#D1A866]/70 hover:text-[#D1A866]"
                >
                  View summary
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#F3F1EA]/40">No completed meetings yet.</p>
      )}
    </section>
  );
}
