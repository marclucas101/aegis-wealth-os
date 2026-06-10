"use client";

import type { AdvisorNoteRecord } from "@/components/aegis/advisor/AdvisorNoteComposer";

import { NOTE_TYPE_LABELS } from "@/components/aegis/advisor/AdvisorNoteComposer";

interface AdvisorNoteCardProps {
  note: AdvisorNoteRecord;
  canMutate: boolean;
  deleting: boolean;
  onEdit: (note: AdvisorNoteRecord) => void;
  onDelete: (noteId: string) => void;
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

export default function AdvisorNoteCard({
  note,
  canMutate,
  deleting,
  onEdit,
  onDelete,
}: AdvisorNoteCardProps) {
  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/75">
              {NOTE_TYPE_LABELS[note.noteType]}
            </span>
            {note.title ? (
              <p className="truncate text-sm font-light text-[#F3F1EA]">
                {note.title}
              </p>
            ) : null}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm font-light leading-relaxed text-[#F3F1EA]/75">
            {note.body}
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
            <time dateTime={note.createdAt}>
              {note.updatedAt !== note.createdAt
                ? `Updated ${formatTimestamp(note.updatedAt)}`
                : formatTimestamp(note.createdAt)}
            </time>
          </div>
        </div>

        {canMutate ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onEdit(note)}
              disabled={deleting}
              className="rounded-sm border border-[#D1A866]/20 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/60 transition hover:border-[#D1A866]/35 hover:text-[#F3F1EA] disabled:opacity-45"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              disabled={deleting}
              className="rounded-sm border border-red-400/20 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-red-200/70 transition hover:border-red-400/35 hover:text-red-100 disabled:opacity-45"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
