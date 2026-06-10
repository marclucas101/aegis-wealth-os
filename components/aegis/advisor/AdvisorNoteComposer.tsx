"use client";

import { useEffect, useState } from "react";

export const ADVISOR_NOTE_TYPES = [
  "general",
  "meeting",
  "follow_up",
  "risk",
  "review",
] as const;

export type AdvisorNoteType = (typeof ADVISOR_NOTE_TYPES)[number];

export type AdvisorNoteRecord = {
  id: string;
  clientId: string;
  advisorUserId: string;
  title: string | null;
  body: string;
  noteType: AdvisorNoteType;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NoteComposerMode = "create" | "edit";

export type NoteComposerValues = {
  title: string;
  body: string;
  noteType: AdvisorNoteType;
};

interface AdvisorNoteComposerProps {
  mode: NoteComposerMode;
  initialValues?: NoteComposerValues;
  saving: boolean;
  saveState: "idle" | "saved" | "error";
  errorMessage?: string | null;
  onSubmit: (values: NoteComposerValues) => void;
  onCancel?: () => void;
}

const NOTE_TYPE_LABELS: Record<AdvisorNoteType, string> = {
  general: "General",
  meeting: "Meeting Summary",
  follow_up: "Follow-up",
  risk: "Risk Observation",
  review: "Review Prep",
};

const EMPTY_VALUES: NoteComposerValues = {
  title: "",
  body: "",
  noteType: "general",
};

export default function AdvisorNoteComposer({
  mode,
  initialValues,
  saving,
  saveState,
  errorMessage,
  onSubmit,
  onCancel,
}: AdvisorNoteComposerProps) {
  const [values, setValues] = useState<NoteComposerValues>(
    initialValues ?? EMPTY_VALUES,
  );

  useEffect(() => {
    setValues(initialValues ?? EMPTY_VALUES);
  }, [initialValues, mode]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.body.trim() || saving) {
      return;
    }

    onSubmit({
      title: values.title.trim(),
      body: values.body.trim(),
      noteType: values.noteType,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4 sm:p-5"
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
              Note Type
            </span>
            <select
              value={values.noteType}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  noteType: event.target.value as AdvisorNoteType,
                }))
              }
              disabled={saving}
              className="mt-2 w-full rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
            >
              {ADVISOR_NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {NOTE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
              Title
            </span>
            <input
              type="text"
              value={values.title}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              disabled={saving}
              placeholder="Optional headline"
              className="mt-2 w-full rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light text-[#F3F1EA] placeholder:text-[#F3F1EA]/25 outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
            Note Body
          </span>
          <textarea
            value={values.body}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                body: event.target.value,
              }))
            }
            disabled={saving}
            rows={5}
            placeholder="Meeting summary, follow-up actions, risk observations, or review notes…"
            className="mt-2 w-full resize-y rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 px-3 py-2.5 text-sm font-light leading-relaxed text-[#F3F1EA] placeholder:text-[#F3F1EA]/25 outline-none transition focus:border-[#D1A866]/45 disabled:opacity-50"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || !values.body.trim()}
          className="rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/12 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA] transition hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Save Note"
              : "Update Note"}
        </button>

        {mode === "edit" && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-sm border border-[#D1A866]/15 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA]/55 transition hover:text-[#F3F1EA] disabled:opacity-45"
          >
            Cancel
          </button>
        ) : null}

        {saveState === "saved" ? (
          <span className="text-[11px] uppercase tracking-[0.12em] text-emerald-300/75">
            Saved
          </span>
        ) : null}

        {saveState === "error" && errorMessage ? (
          <span className="text-[11px] text-red-200/80">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}

export function noteToComposerValues(note: AdvisorNoteRecord): NoteComposerValues {
  return {
    title: note.title ?? "",
    body: note.body,
    noteType: note.noteType,
  };
}

export { NOTE_TYPE_LABELS };
