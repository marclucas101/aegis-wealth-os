"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JobRunSummary = {
  id: string;
  jobName: string;
  triggerSource: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  itemsExamined: number;
  itemsSucceeded: number;
  itemsSkipped: number;
  itemsFailed: number;
  sanitizedError: string | null;
};

export default function AdminJobOperationsClient() {
  const [runs, setRuns] = useState<JobRunSummary[]>([]);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [activeRun, setActiveRun] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState<JobRunSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setError(null);
      try {
        const res = await fetch("/api/admin/jobs/runs?jobName=scheduled_publishing", {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.ok) {
          setError(data.error ?? "Failed to load job history");
          return;
        }
        setRuns(data.runs ?? []);
        setFeatureEnabled(Boolean(data.featureEnabled));
        setActiveRun(Boolean(data.activeRun));
      } catch {
        if (!cancelled) setError("Failed to load job history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshHistory() {
    setError(null);
    try {
      const res = await fetch("/api/admin/jobs/runs?jobName=scheduled_publishing", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load job history");
        return;
      }
      setRuns(data.runs ?? []);
      setFeatureEnabled(Boolean(data.featureEnabled));
      setActiveRun(Boolean(data.activeRun));
    } catch {
      setError("Failed to load job history");
    }
  }

  async function runNow() {
    setRunLoading(true);
    setError(null);
    setLastRunSummary(null);

    try {
      const res = await fetch("/api/admin/jobs/scheduled-publishing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Run failed");
        return;
      }

      if (data.activeRunBlocked) {
        setError("A run is already active. Wait for it to complete.");
      } else if (data.run) {
        setLastRunSummary(data.run);
      }

      setConfirmOpen(false);
      await refreshHistory();
    } catch {
      setError("Run failed");
    } finally {
      setRunLoading(false);
    }
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  if (loading) {
    return <p className="text-sm text-[#F3F1EA]/50">Loading job operations…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#F3F1EA]/50">
          Scheduled publishing automation runs due governed content through the same publication workflow as manual admin publish.
        </p>
        <Link
          href="/admin/communications"
          className="text-xs text-[#D1A866] underline underline-offset-2"
        >
          ← Content governance
        </Link>
      </div>

      {!featureEnabled && (
        <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/80">
          Scheduled content automation is disabled. Enable the{" "}
          <code className="text-amber-200/90">scheduled_content_automation</code> feature control to allow automated runs. Manual publish remains available.
        </div>
      )}

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200/80">
          {error}
        </div>
      )}

      {lastRunSummary && (
        <div className="rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/5 px-4 py-3 text-sm text-[#F3F1EA]/80">
          Last run: {lastRunSummary.status} — examined {lastRunSummary.itemsExamined}, succeeded{" "}
          {lastRunSummary.itemsSucceeded}, skipped {lastRunSummary.itemsSkipped}, failed{" "}
          {lastRunSummary.itemsFailed}
          {lastRunSummary.sanitizedError && (
            <span className="mt-1 block text-red-200/70">{lastRunSummary.sanitizedError}</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!confirmOpen ? (
          <button
            type="button"
            disabled={runLoading || activeRun}
            onClick={() => setConfirmOpen(true)}
            className="rounded-sm bg-[#D1A866]/20 px-4 py-2 text-sm text-[#D1A866] disabled:opacity-50"
          >
            {activeRun ? "Run in progress…" : "Run scheduled publishing now"}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-[#D1A866]/25 bg-[#10283A]/40 px-4 py-3">
            <span className="text-sm text-[#F3F1EA]/70">
              Publish all due scheduled content now? This cannot bypass approval or scheduled time.
            </span>
            <button
              type="button"
              disabled={runLoading}
              onClick={() => void runNow()}
              className="rounded-sm bg-[#D1A866]/25 px-3 py-1.5 text-xs text-[#D1A866] disabled:opacity-50"
            >
              Confirm run
            </button>
            <button
              type="button"
              disabled={runLoading}
              onClick={() => setConfirmOpen(false)}
              className="rounded-sm border border-[#D1A866]/20 px-3 py-1.5 text-xs text-[#F3F1EA]/50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <h3 className="mb-3 text-sm font-medium text-[#F3F1EA]/70">Job history</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-[#F3F1EA]/40">No job runs recorded yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#D1A866]/15 text-[10px] uppercase tracking-wider text-[#F3F1EA]/40">
                <th className="py-2 pr-4">Job</th>
                <th className="py-2 pr-4">Trigger</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Examined</th>
                <th className="py-2 pr-4">OK</th>
                <th className="py-2 pr-4">Skip</th>
                <th className="py-2 pr-4">Fail</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-[#D1A866]/10">
                  <td className="py-3 pr-4 text-[#F3F1EA]/60">{run.jobName}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{run.triggerSource}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{run.status}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/40">
                    {new Date(run.startedAt).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/40">{formatDuration(run.durationMs)}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{run.itemsExamined}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{run.itemsSucceeded}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{run.itemsSkipped}</td>
                  <td className="py-3 pr-4 text-[#F3F1EA]/50">{run.itemsFailed}</td>
                  <td className="py-3 text-xs text-red-200/60">{run.sanitizedError ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
