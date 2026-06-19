"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { MeetingPresentationDto } from "@/lib/compliance/meetingPresentationDtos";
import {
  ACKNOWLEDGEMENT_ITEMS,
  SELECTABLE_SECTIONS,
  STRESS_SCENARIO_KEYS,
  STRESS_SCENARIO_LABELS,
  type CloseState,
  type MeetingSectionType,
} from "@/lib/compliance/meetingStudioTypes";
import type { MeetingSessionRow } from "@/lib/supabase/meetingSessionPersistence";

type MeetingPreparationSummary = {
  clientName: string;
  relationshipStage: string;
  profileCompletenessPercent: number;
  missingInformation: string[];
  publicationCount: number;
  dataQualityWarnings: string[];
};

type StudioStage = "prepare" | "present" | "close";

type MeetingSessionsResponse =
  | {
      ok: true;
      sessions: MeetingSessionRow[];
      preparation: {
        clientName: string;
        relationshipStage: string;
        profileCompletenessPercent: number;
        missingInformation: string[];
        publicationCount: number;
        dataQualityWarnings: string[];
      };
    }
  | { ok: false; error?: string; reason?: string };

interface MeetingStudioClientProps {
  clientId: string;
  initialSessionId?: string;
  initialStage?: StudioStage;
}

const SECTION_LABELS: Record<MeetingSectionType, string> = {
  welcome: "Welcome and meeting purpose",
  priorities: "Your priorities",
  facts_and_assumptions: "Facts and assumptions",
  financial_foundation: "Financial foundation",
  broad_strengths: "Broad strengths",
  areas_for_review: "Areas requiring discussion",
  protection_resilience: "Protection and resilience",
  scenario_education: "Scenario education",
  goal_alignment: "Goal alignment",
  adviser_observations: "Adviser observations",
  agreed_priorities: "Agreed priorities",
  next_steps: "Next steps",
};

export default function MeetingStudioClient({
  clientId,
  initialSessionId,
  initialStage = "prepare",
}: MeetingStudioClientProps) {
  const [stage, setStage] = useState<StudioStage>(initialStage);
  const [session, setSession] = useState<MeetingSessionRow | null>(null);
  const [preparation, setPreparation] = useState<MeetingPreparationSummary | null>(null);
  const [selectedSections, setSelectedSections] = useState<MeetingSectionType[]>([]);
  const [purpose, setPurpose] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [presentation, setPresentation] = useState<MeetingPresentationDto | null>(null);
  const [presentationIndex, setPresentationIndex] = useState(0);
  const [closeState, setCloseState] = useState<CloseState>({
    meetingVisibleObservations: [],
    agreedPriorities: [],
    deferredTopics: [],
    clientQuestions: [],
    administrativeNextSteps: [],
    clientSafeSummaryText: "",
    internalAdviserNotes: "",
  });
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/meeting-sessions`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as MeetingSessionsResponse;
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error ?? data.reason ?? "Unable to load Meeting Studio");
          return;
        }
        setPreparation(data.preparation);

        if (initialSessionId) {
          const sessionRes = await fetch(
            `/api/advisor/clients/${clientId}/meeting-sessions/${initialSessionId}`,
            { cache: "no-store" },
          );
          const sessionData = (await sessionRes.json()) as {
            ok: boolean;
            session?: MeetingSessionRow;
          };
          if (cancelled) return;
          if (sessionData.ok && sessionData.session) {
            setSession(sessionData.session);
            setSelectedSections(sessionData.session.selected_sections);
            setPurpose(sessionData.session.purpose ?? "");
            setTitle(sessionData.session.title ?? "");
            setCloseState((prev) => sessionData.session!.close_state ?? prev);
            if (sessionData.session.status === "in_progress") {
              setStage("present");
            } else if (sessionData.session.status === "completed") {
              setStage("close");
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, initialSessionId]);

  async function createSession() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/meeting-sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingType: "review", title, purpose }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        session?: MeetingSessionRow;
        error?: string;
      };
      if (!data.ok || !data.session) {
        setError(data.error ?? "Failed to create session");
        return;
      }
      setSession(data.session);
    } finally {
      setSaving(false);
    }
  }

  async function savePreparation() {
    if (!session) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/prepare`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedSections, purpose, title }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        session?: MeetingSessionRow;
        error?: string;
      };
      if (!data.ok || !data.session) {
        setError(data.error ?? "Failed to save preparation");
        return;
      }
      setSession(data.session);
    } finally {
      setSaving(false);
    }
  }

  async function startMeeting() {
    if (!session) return;
    setSaving(true);
    try {
      await savePreparation();
      const response = await fetch(
        `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/start`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const data = (await response.json()) as {
        ok: boolean;
        session?: MeetingSessionRow;
        error?: string;
      };
      if (!data.ok || !data.session) {
        setError(data.error ?? "Failed to start meeting");
        return;
      }
      setSession(data.session);
      setStage("present");
      await loadPresentation(data.session.id);
    } finally {
      setSaving(false);
    }
  }

  async function loadPresentation(sessionId: string) {
    const response = await fetch(
      `/api/advisor/clients/${clientId}/meeting-sessions/${sessionId}/presentation`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as {
      ok: boolean;
      presentation?: MeetingPresentationDto;
      error?: string;
    };
    if (data.ok && data.presentation) {
      setPresentation(data.presentation);
      setPresentationIndex(0);
    }
  }

  async function recordSectionShown(sectionType: MeetingSectionType) {
    if (!session) return;
    await fetch(
      `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/section-shown`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType }),
      },
    );
  }

  async function completeMeeting() {
    if (!session) return;
    setSaving(true);
    try {
      await fetch(
        `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ closeState }),
        },
      );

      if (selectedScenarios.length > 0) {
        await fetch(
          `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/prepare`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedSections,
              scenarioKeys: selectedScenarios,
            }),
          },
        );
      }

      const response = await fetch(
        `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ closeState }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        session?: MeetingSessionRow;
        error?: string;
      };
      if (!data.ok || !data.session) {
        setError(data.error ?? "Failed to complete meeting");
        return;
      }
      setSession(data.session);

      await fetch(
        `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/prepare-summary`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );

      setStage("close");
    } finally {
      setSaving(false);
    }
  }

  function toggleSection(section: MeetingSectionType) {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section],
    );
  }

  if (loading) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center text-sm text-[#F3F1EA]/40">
        Loading Meeting Studio…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-6 py-8 text-sm text-amber-100/80">
        {error}
      </div>
    );
  }

  if (stage === "present" && presentation && session) {
    const currentSection = presentation.sections[presentationIndex];
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0B1E2D] text-[#F3F1EA]">
        <header className="flex items-center justify-between border-b border-emerald-500/20 px-6 py-4 md:px-10">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400/70">
              {presentation.adviserLedLabel}
            </p>
            <h1 className="mt-1 text-xl font-light md:text-2xl">
              {presentation.clientName}
            </h1>
            <p className="text-sm text-[#F3F1EA]/50">
              {presentation.adviserName}
              {presentation.meetingDate
                ? ` · ${new Date(presentation.meetingDate).toLocaleDateString()}`
                : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStage("close")}
            className="rounded-sm border border-[#D1A866]/30 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] hover:bg-[#D1A866]/10"
          >
            Exit presentation
          </button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 md:px-16">
          {currentSection ? (
            <div className="max-w-3xl text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
                {currentSection.educationalLabel}
              </p>
              <h2 className="mt-4 text-3xl font-light text-emerald-100 md:text-4xl">
                {currentSection.heading}
              </h2>
              <PresentationSectionBody section={currentSection} />
            </div>
          ) : null}
        </main>

        <footer className="border-t border-emerald-500/20 px-6 py-4 md:px-10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={presentationIndex === 0}
              onClick={() => setPresentationIndex((i) => Math.max(0, i - 1))}
              className="rounded-sm border border-[#D1A866]/20 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/60 disabled:opacity-30"
            >
              Previous
            </button>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40">
              {presentationIndex + 1} / {presentation.sections.length}
            </p>
            <button
              type="button"
              disabled={presentationIndex >= presentation.sections.length - 1}
              onClick={() => {
                const next = presentationIndex + 1;
                if (currentSection) {
                  void recordSectionShown(currentSection.sectionType);
                }
                setPresentationIndex(next);
              }}
              className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-emerald-300"
            >
              Next
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#F3F1EA]/30">
            Data as at {new Date(presentation.dataAsAt).toLocaleDateString()}
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
            Meeting Studio
          </p>
          <h1 className="mt-2 text-2xl font-light text-[#F3F1EA]">
            {preparation?.clientName ?? "Client meeting"}
          </h1>
          {preparation ? (
            <p className="mt-1 text-sm text-[#F3F1EA]/50">
              Stage: {preparation.relationshipStage.replace(/_/g, " ")} ·{" "}
              {preparation.profileCompletenessPercent}% profile complete
            </p>
          ) : null}
        </div>
        <Link
          href={`/advisor/clients/${clientId}`}
          className="text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40 hover:text-[#D1A866]"
        >
          ← Back to client file
        </Link>
      </header>

      <nav className="flex gap-2 border-b border-[#D1A866]/10 pb-3">
        {(["prepare", "present", "close"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStage(tab)}
            className={
              stage === tab
                ? "border-b border-[#D1A866] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]"
                : "px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40 hover:text-[#F3F1EA]/70"
            }
          >
            {tab}
          </button>
        ))}
      </nav>

      {stage === "prepare" ? (
        <section className="space-y-6">
          {!session ? (
            <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6">
              <p className="text-sm text-[#F3F1EA]/60">
                Create a new meeting session to begin preparation.
              </p>
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Meeting title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-sm border border-[#D1A866]/15 bg-transparent px-3 py-2 text-sm text-[#F3F1EA]"
                />
                <input
                  type="text"
                  placeholder="Meeting purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-sm border border-[#D1A866]/15 bg-transparent px-3 py-2 text-sm text-[#F3F1EA]"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void createSession()}
                className="mt-4 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300"
              >
                Create session
              </button>
            </div>
          ) : null}

          {preparation && preparation.missingInformation.length > 0 ? (
            <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-amber-300/70">
                Missing information
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-amber-100/70">
                {preparation.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/60">
              Select presentation sections
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SELECTABLE_SECTIONS.map((section) => (
                <label
                  key={section}
                  className="flex cursor-pointer items-center gap-3 rounded-sm border border-[#D1A866]/10 px-3 py-2 hover:border-[#D1A866]/25"
                >
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(section)}
                    onChange={() => toggleSection(section)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-[#F3F1EA]/80">
                    {SECTION_LABELS[section]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!session || saving}
              onClick={() => void savePreparation()}
              className="rounded-sm border border-[#D1A866]/20 px-5 py-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/70"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={!session || selectedSections.length === 0 || saving}
              onClick={() => void startMeeting()}
              className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300"
            >
              Start meeting
            </button>
          </div>
        </section>
      ) : null}

      {stage === "close" && session ? (
        <section className="space-y-6">
          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6 space-y-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/60">
              Close meeting
            </p>

            <label className="block">
              <span className="text-xs text-[#F3F1EA]/50">
                Meeting-visible observations (separate from internal notes)
              </span>
              <textarea
                value={(closeState.meetingVisibleObservations ?? []).join("\n")}
                onChange={(e) =>
                  setCloseState({
                    ...closeState,
                    meetingVisibleObservations: e.target.value
                      .split("\n")
                      .filter(Boolean),
                  })
                }
                rows={3}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-transparent px-3 py-2 text-sm text-[#F3F1EA]"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#F3F1EA]/50">Agreed priorities</span>
              <textarea
                value={(closeState.agreedPriorities ?? []).join("\n")}
                onChange={(e) =>
                  setCloseState({
                    ...closeState,
                    agreedPriorities: e.target.value.split("\n").filter(Boolean),
                  })
                }
                rows={2}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-transparent px-3 py-2 text-sm text-[#F3F1EA]"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#F3F1EA]/50">
                Client-safe summary text (requires publication review)
              </span>
              <textarea
                value={closeState.clientSafeSummaryText ?? ""}
                onChange={(e) =>
                  setCloseState({
                    ...closeState,
                    clientSafeSummaryText: e.target.value,
                  })
                }
                rows={3}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-transparent px-3 py-2 text-sm text-[#F3F1EA]"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#F3F1EA]/50">
                Internal adviser notes (never shown in presentation)
              </span>
              <textarea
                value={closeState.internalAdviserNotes ?? ""}
                onChange={(e) =>
                  setCloseState({
                    ...closeState,
                    internalAdviserNotes: e.target.value,
                  })
                }
                rows={2}
                className="mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-transparent px-3 py-2 text-sm text-[#F3F1EA]/60"
              />
            </label>

            <div>
              <p className="text-xs text-[#F3F1EA]/50">Scenario selection</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {STRESS_SCENARIO_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScenarios.includes(key)}
                      onChange={() =>
                        setSelectedScenarios((prev) =>
                          prev.includes(key)
                            ? prev.filter((k) => k !== key)
                            : [...prev, key],
                        )
                      }
                      className="accent-emerald-500"
                    />
                    {STRESS_SCENARIO_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-[#F3F1EA]/50">Acknowledgements</p>
              <div className="mt-2 space-y-2">
                {ACKNOWLEDGEMENT_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      void fetch(
                        `/api/advisor/clients/${clientId}/meeting-sessions/${session.id}/record-acknowledgement`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            itemKey: item.key,
                            method: "verbal_recorded",
                          }),
                        },
                      )
                    }
                    className="block w-full rounded-sm border border-[#D1A866]/10 px-3 py-2 text-left text-sm text-[#F3F1EA]/70 hover:border-emerald-500/30"
                  >
                    Record: {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {session.status !== "completed" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeMeeting()}
              className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-6 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300"
            >
              Complete meeting
            </button>
          ) : (
            <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-100/80">
              Meeting completed. Summary status: {session.summary_status}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function PresentationSectionBody({
  section,
}: {
  section: MeetingPresentationDto["sections"][number];
}) {
  switch (section.sectionType) {
    case "welcome":
      return section.purpose ? (
        <p className="mt-6 text-lg text-[#F3F1EA]/70">{section.purpose}</p>
      ) : null;
    case "priorities":
      return (
        <ul className="mt-6 space-y-2 text-lg text-[#F3F1EA]/70">
          {section.goals.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      );
    case "financial_foundation":
      return (
        <p className="mt-6 text-lg text-[#F3F1EA]/70">{section.cashFlowPosition}</p>
      );
    case "broad_strengths":
      return (
        <ul className="mt-6 space-y-2 text-lg text-[#F3F1EA]/70">
          {section.strengths.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      );
    case "areas_for_review":
      return (
        <ul className="mt-6 space-y-2 text-lg text-[#F3F1EA]/70">
          {section.areas.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      );
    case "adviser_observations":
      return (
        <ul className="mt-6 space-y-2 text-lg text-[#F3F1EA]/70">
          {(section.observations.length > 0
            ? section.observations
            : ["Adviser-led discussion"]
          ).map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      );
    case "agreed_priorities":
      return (
        <ul className="mt-6 space-y-2 text-lg text-[#F3F1EA]/70">
          {(section.priorities.length > 0
            ? section.priorities
            : ["To be agreed with your adviser"]
          ).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      );
    case "next_steps":
      return (
        <ul className="mt-6 space-y-2 text-lg text-[#F3F1EA]/70">
          {(section.administrativeSteps.length > 0
            ? section.administrativeSteps
            : ["Follow-up to be arranged"]
          ).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      );
    default:
      return (
        <p className="mt-6 text-lg text-[#F3F1EA]/70">
          Based on information provided — adviser-led discussion
        </p>
      );
  }
}
