"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BINDER_READINESS_USER_MESSAGE,
  type BinderSection,
} from "@/lib/binder/binderSectionPolicy";
import type { BinderPackPurpose } from "@/lib/binder/binderPackPurpose";
import { BINDER_PACK_PURPOSE_LABELS, BINDER_UI_PACK_PURPOSES } from "@/lib/binder/binderPackPurpose";
import type { BinderSectionReadiness } from "@/lib/binder/binderContentPreparation";

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

type BinderReadiness = {
  purpose: BinderPackPurpose;
  ready: boolean;
  availableSections: string[];
  sections: BinderSectionReadiness[];
};

interface AdvisorClientBinderPanelProps {
  clientId: string;
}

type PanelState = "loading" | "ready" | "disabled" | "error";

const SELECTABLE_SECTIONS = new Set<BinderSection>([
  "financial_overview",
  "my_plan",
  "agreed_priorities",
  "roadmap",
  "meeting_summary",
  "document_index",
  "next_review_date",
]);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: BinderSectionReadiness["status"]): string {
  switch (status) {
    case "available":
      return "Published";
    case "draft_available":
      return "Draft available";
    case "not_created":
      return "Not created";
    case "not_published":
      return "Ready to publish";
    case "not_current":
      return "Not current";
    case "not_client_visible":
      return "Not client-visible";
    default:
      return "Unavailable";
  }
}

function groupSections(sections: BinderSectionReadiness[]) {
  const required: BinderSectionReadiness[] = [];
  const optional: BinderSectionReadiness[] = [];
  const postMeeting: BinderSectionReadiness[] = [];

  for (const section of sections) {
    if (section.postMeeting) {
      postMeeting.push(section);
    } else if (section.requiredForPurpose) {
      required.push(section);
    } else if (SELECTABLE_SECTIONS.has(section.sectionId)) {
      optional.push(section);
    }
  }

  return { required, optional, postMeeting };
}

export default function AdvisorClientBinderPanel({ clientId }: AdvisorClientBinderPanelProps) {
  const [state, setState] = useState<PanelState>("loading");
  const [binders, setBinders] = useState<BinderListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<BinderReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [meetingDate, setMeetingDate] = useState(todayIsoDate);
  const [purpose, setPurpose] = useState<BinderPackPurpose>("meeting_preparation");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const loadReadiness = useCallback(
    async (date: string, selected: string[]) => {
      setReadinessLoading(true);
      try {
        const params = new URLSearchParams({
          meetingDate: date,
          purpose,
        });
        if (selected.length > 0) {
          params.set("selectedSections", selected.join(","));
        }
        const response = await fetch(
          `/api/advisor/clients/${clientId}/binder-export/readiness?${params.toString()}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as
          | { ok: true; readiness: BinderReadiness }
          | { ok: false; error?: string };

        if (!response.ok || !data.ok) {
          throw new Error(!data.ok ? data.error ?? "Failed to check readiness" : "Failed to check readiness");
        }

        setReadiness(data.readiness);
        if (selected.length === 0) {
          setSelectedSections(
            data.readiness.sections
              .filter((section) => section.selectedByDefault)
              .map((section) => section.sectionId),
          );
        }
      } catch (err) {
        setReadiness(null);
        setError(err instanceof Error ? err.message : "Failed to check readiness");
        setState("error");
      } finally {
        setReadinessLoading(false);
      }
    },
    [clientId, purpose],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setState("loading");
      setError(null);
      setErrorCode(null);
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
        await loadReadiness(meetingDate, []);
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
  }, [clientId, loadReadiness, meetingDate]);

  const grouped = useMemo(
    () => groupSections(readiness?.sections ?? []),
    [readiness?.sections],
  );

  const selectedAvailableCount = useMemo(() => {
    if (!readiness) return 0;
    const selected = new Set(selectedSections);
    return readiness.sections.filter(
      (section) => selected.has(section.sectionId) && section.status === "available",
    ).length;
  }, [readiness, selectedSections]);

  const canGenerate = useMemo(() => {
    if (!readiness || activeId !== null) return false;
    return readiness.sections
      .filter((section) => selectedSections.includes(section.sectionId))
      .every((section) => section.status === "available" || section.sectionId === "meeting_date")
      && Boolean(meetingDate.trim())
      && selectedAvailableCount > 0;
  }, [readiness, activeId, selectedSections, meetingDate, selectedAvailableCount]);

  const generateLabel =
    selectedAvailableCount > 0
      ? `Generate pack with ${selectedAvailableCount} section${selectedAvailableCount === 1 ? "" : "s"}`
      : "Generate meeting pack";

  function toggleSection(sectionId: string, checked: boolean) {
    setSelectedSections((current) => {
      if (checked) return Array.from(new Set([...current, sectionId]));
      return current.filter((id) => id !== sectionId);
    });
  }

  async function reloadBinders() {
    const response = await fetch(`/api/advisor/clients/${clientId}/binder-exports`, {
      cache: "no-store",
    });
    const data = (await response.json()) as
      | { ok: true; binders: BinderListItem[] }
      | { ok: false; error?: string };
    if (!response.ok || !data.ok) {
      throw new Error(!data.ok ? data.error ?? "Failed to load binders" : "Failed to load binders");
    }
    setBinders(data.binders);
  }

  async function handleGenerate() {
    setActiveId("generate");
    setMessage(null);
    setError(null);
    setErrorCode(null);
    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/binder-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingDate,
          sections: [
            "cover_page",
            "client_adviser_info",
            "meeting_date",
            ...selectedSections,
          ],
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data.ok) {
        setErrorCode(data.code ?? null);
        throw new Error(data.error ?? "Generation failed");
      }
      setMessage("Meeting pack generated.");
      await reloadBinders();
      await loadReadiness(meetingDate, selectedSections);
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
    setErrorCode(null);
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
      await reloadBinders();
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
    setErrorCode(null);
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
      await reloadBinders();
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

  function renderSectionCard(section: BinderSectionReadiness) {
    const selectable = SELECTABLE_SECTIONS.has(section.sectionId);
    const selected = selectedSections.includes(section.sectionId);
    const canSelect = selectable && section.status === "available";

    return (
      <li
        key={section.sectionId}
        className="rounded-lg border border-[#10283A]/10 bg-white px-4 py-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {canSelect ? (
                <label className="flex items-center gap-2 text-sm font-medium text-[#10283A]">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => toggleSection(section.sectionId, event.target.checked)}
                  />
                  {section.label}
                </label>
              ) : (
                <p className="text-sm font-medium text-[#10283A]">{section.label}</p>
              )}
              {section.requiredForPurpose ? (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                  Required
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[#10283A]/60">Status: {statusLabel(section.status)}</p>
            {section.explanation ? (
              <p className="mt-1 text-xs text-[#10283A]/50">{section.explanation}</p>
            ) : null}
          </div>
          {section.action ? (
            <Link
              href={section.action.href}
              className="rounded border border-[#10283A]/20 px-3 py-1.5 text-xs text-[#10283A] hover:bg-[#10283A]/5"
            >
              {section.action.label}
            </Link>
          ) : section.status === "available" && selectable ? (
            <span className="text-xs text-[#107A5E]">Included in pack</span>
          ) : null}
        </div>
      </li>
    );
  }

  function renderSectionGroup(title: string, sections: BinderSectionReadiness[]) {
    if (sections.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-[#10283A]">{title}</h4>
        <ul className="space-y-2">{sections.map(renderSectionCard)}</ul>
      </div>
    );
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#10283A]">Client meeting packs</h3>
          <p className="text-sm text-[#10283A]/60">
            Choose a meeting date, prepare published planning outputs, select sections, then
            generate the pack.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[#10283A]/70">
            <span>Meeting date</span>
            <input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="rounded border border-[#10283A]/20 px-2 py-1 text-sm text-[#10283A]"
            />
          </label>
          {BINDER_UI_PACK_PURPOSES.length > 1 ? (
            <label className="flex items-center gap-2 text-sm text-[#10283A]/70">
              <span>Pack purpose</span>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as BinderPackPurpose)}
                className="rounded border border-[#10283A]/20 px-2 py-1 text-sm text-[#10283A]"
              >
                {BINDER_UI_PACK_PURPOSES.map((value) => (
                  <option key={value} value={value}>
                    {BINDER_PACK_PURPOSE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="rounded border border-[#10283A]/10 px-2 py-1 text-xs text-[#10283A]/60">
              {BINDER_PACK_PURPOSE_LABELS[purpose]}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadReadiness(meetingDate, selectedSections)}
            disabled={readinessLoading || activeId !== null}
            className="rounded border border-[#10283A]/20 px-3 py-2 text-sm text-[#10283A] disabled:opacity-50"
          >
            {readinessLoading ? "Refreshing…" : "Refresh readiness"}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className="rounded-lg bg-[#107A5E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {activeId === "generate" ? "Generating…" : generateLabel}
          </button>
        </div>
      </div>

      {readiness ? (
        <div className="space-y-4 rounded-xl border border-[#10283A]/10 bg-[#F8FAFB] p-4">
          {!canGenerate && !readiness.ready ? (
            <p className="text-sm text-amber-900">{BINDER_READINESS_USER_MESSAGE}</p>
          ) : null}
          {renderSectionGroup("Required before generation", grouped.required)}
          {renderSectionGroup("Optional additions", grouped.optional)}
          {renderSectionGroup("Created after the meeting", grouped.postMeeting)}
        </div>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-[#107A5E]/30 bg-[#107A5E]/5 px-4 py-2 text-sm text-[#107A5E]">
          {message}
        </p>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <p>{error}</p>
          {errorCode ? (
            <p className="mt-1 text-xs text-red-500/80">Reference: {errorCode}</p>
          ) : null}
        </div>
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
