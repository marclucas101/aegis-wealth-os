"use client";

import { useCallback, useEffect, useState } from "react";

type BinderListItem = {
  id: string;
  binderLineageId: string;
  version: number;
  generationStatus: string;
  lifecycleStatus: string;
  sectionsIncluded: string[];
  meetingDate: string | null;
  createdAt: string;
  generationCompletedAt: string | null;
};

interface AdvisorClientBinderPanelProps {
  clientId: string;
}

type PanelState = "loading" | "ready" | "disabled" | "error";

export default function AdvisorClientBinderPanel({ clientId }: AdvisorClientBinderPanelProps) {
  const [state, setState] = useState<PanelState>("loading");
  const [binders, setBinders] = useState<BinderListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBinders = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/binder-exports`, {
        cache: "no-store",
      });
      const data = (await response.json()) as
        | { ok: true; binders: BinderListItem[] }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        if (data.ok === false && data.error === "Binder export is disabled") {
          setState("disabled");
          return;
        }
        throw new Error(!data.ok ? data.error ?? "Failed to load binders" : "Failed to load binders");
      }

      setBinders(data.binders);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load binders");
      setState("error");
    }
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setState("loading");
      setError(null);
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}/binder-exports`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | { ok: true; binders: BinderListItem[] }
          | { ok: false; error?: string };

        if (cancelled) return;

        if (!response.ok || !data.ok) {
          if (data.ok === false && data.error === "Binder export is disabled") {
            setState("disabled");
            return;
          }
          throw new Error(!data.ok ? data.error ?? "Failed to load binders" : "Failed to load binders");
        }

        setBinders(data.binders);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load binders");
        setState("error");
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function handleGenerate() {
    setActiveId("generate");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/binder-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingDate: new Date().toISOString().slice(0, 10) }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Generation failed");
      }
      setMessage("Meeting pack generated.");
      await loadBinders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setActiveId(null);
    }
  }

  async function handlePublish(binderId: string) {
    if (
      !window.confirm(
        "Publish this meeting pack to the client document vault? The client will be able to view it.",
      )
    ) {
      return;
    }
    setActiveId(binderId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/binder-exports/${binderId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Publication failed");
      }
      setMessage("Binder published to client vault.");
      await loadBinders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publication failed");
    } finally {
      setActiveId(null);
    }
  }

  async function handleWithdraw(binderId: string) {
    if (
      !window.confirm(
        "Withdraw this binder from the client vault? The client will no longer be able to open it.",
      )
    ) {
      return;
    }
    setActiveId(binderId);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/binder-exports/${binderId}/withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "adviser_withdrawal" }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Withdrawal failed");
      }
      setMessage("Binder withdrawn from client access.");
      await loadBinders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setActiveId(null);
    }
  }

  async function handleDownload(binderId: string) {
    setActiveId(`dl-${binderId}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/binder-exports/${binderId}/signed-url`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as
        | { ok: true; signedUrl: string }
        | { ok: false; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(!data.ok ? data.error ?? "Download unavailable" : "Download unavailable");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setActiveId(null);
    }
  }

  function lifecycleLabel(binder: BinderListItem): string {
    if (binder.lifecycleStatus === "published_to_client") return "Published to client";
    if (binder.lifecycleStatus === "withdrawn") return "Withdrawn";
    if (binder.generationStatus === "ready") return "Ready — not published";
    if (binder.generationStatus === "failed") return "Generation failed";
    if (binder.generationStatus === "generating") return "Generating…";
    return binder.generationStatus;
  }

  if (state === "disabled") {
    return (
      <div className="rounded-xl border border-[#10283A]/10 bg-white p-6 text-sm text-[#10283A]/70">
        Binder export is disabled for this environment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#10283A]">Client meeting packs</h3>
          <p className="text-sm text-[#10283A]/60">
            Generate PDF meeting packs, publish to the client vault, or withdraw access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={activeId !== null}
          className="rounded-lg bg-[#107A5E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {activeId === "generate" ? "Generating…" : "Generate meeting pack"}
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-[#107A5E]/30 bg-[#107A5E]/5 px-4 py-2 text-sm text-[#107A5E]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {state === "loading" ? (
        <p className="text-sm text-[#10283A]/60">Loading binders…</p>
      ) : binders.length === 0 ? (
        <p className="text-sm text-[#10283A]/60">No meeting packs yet.</p>
      ) : (
        <ul className="divide-y divide-[#10283A]/10 rounded-xl border border-[#10283A]/10 bg-white">
          {binders.map((binder) => {
            const busy = activeId === binder.id || activeId === `dl-${binder.id}`;
            const canPublish =
              binder.generationStatus === "ready" &&
              binder.lifecycleStatus !== "published_to_client" &&
              binder.lifecycleStatus !== "withdrawn";
            const canWithdraw = binder.lifecycleStatus === "published_to_client";
            const canDownload = binder.generationStatus === "ready";

            return (
              <li key={binder.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-[#10283A]">
                    Version {binder.version}
                    <span className="ml-2 text-xs font-normal text-[#10283A]/50">
                      {lifecycleLabel(binder)}
                    </span>
                  </p>
                  <p className="text-xs text-[#10283A]/50">
                    {binder.sectionsIncluded.length} sections
                    {binder.meetingDate ? ` · Meeting ${binder.meetingDate}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canDownload ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDownload(binder.id)}
                      className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] disabled:opacity-50"
                    >
                      {activeId === `dl-${binder.id}` ? "Opening…" : "Download"}
                    </button>
                  ) : null}
                  {canPublish ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePublish(binder.id)}
                      className="rounded bg-[#10283A] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      {activeId === binder.id ? "Publishing…" : "Publish to client"}
                    </button>
                  ) : null}
                  {canWithdraw ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleWithdraw(binder.id)}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                    >
                      {activeId === binder.id ? "Withdrawing…" : "Withdraw"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
