"use client";

import { useState } from "react";

import type { ClientCommitmentActionDto } from "@/lib/crm-v2/service/types";

interface ClientActionsClientProps {
  initialActions: ClientCommitmentActionDto[];
}

export default function ClientActionsClient({ initialActions }: ClientActionsClientProps) {
  const [actions, setActions] = useState(initialActions);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function completeAction(action: ClientCommitmentActionDto) {
    if (!action.canComplete) return;
    setBusyId(action.commitmentId);
    setError(null);
    try {
      const response = await fetch(`/api/actions/${action.commitmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: "completed",
          version: action.version,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Failed to update action");
        return;
      }
      setActions((prev) =>
        prev.map((a) =>
          a.commitmentId === action.commitmentId ? payload.action : a,
        ),
      );
    } catch {
      setError("Failed to update action");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#F3F1EA]/70">
        Actions assigned to you by your adviser. Adviser-only work and internal reviews are not shown here.
      </p>
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {actions.length === 0 ? (
        <p className="text-sm text-[#F3F1EA]/60">No actions at the moment.</p>
      ) : (
        <ul className="space-y-3" role="list">
          {actions.map((action) => (
            <li
              key={action.commitmentId}
              className="rounded-lg border border-[#F3F1EA]/10 bg-[#1A2332]/60 p-4"
            >
              <p className="text-xs uppercase tracking-wide text-[#C9A227]">
                {action.owner} · {action.lifecycleLabel}
              </p>
              <p className="mt-1 font-medium text-[#F3F1EA]">{action.title}</p>
              {action.description ? (
                <p className="mt-1 text-sm text-[#F3F1EA]/70">{action.description}</p>
              ) : null}
              {action.canComplete && action.lifecycleStatus !== "completed" ? (
                <button
                  type="button"
                  onClick={() => void completeAction(action)}
                  disabled={busyId === action.commitmentId}
                  className="mt-3 rounded-md bg-[#C9A227] px-3 py-1.5 text-sm font-medium text-[#0F1A2A] disabled:opacity-50"
                >
                  {busyId === action.commitmentId ? "Saving…" : "Mark complete"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
