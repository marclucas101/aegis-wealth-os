"use client";

import type { AdvisorNoteRecord } from "@/components/aegis/advisor/AdvisorNoteComposer";

import AdvisorNoteCard from "@/components/aegis/advisor/AdvisorNoteCard";

interface AdvisorNoteListProps {
  notes: AdvisorNoteRecord[];
  currentUserId: string | null;
  isAdmin: boolean;
  editingNoteId: string | null;
  deletingNoteId: string | null;
  onEdit: (note: AdvisorNoteRecord) => void;
  onDelete: (noteId: string) => void;
}

export default function AdvisorNoteList({
  notes,
  currentUserId,
  isAdmin,
  editingNoteId,
  deletingNoteId,
  onEdit,
  onDelete,
}: AdvisorNoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="relative px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No advisor notes yet. Capture meeting summaries, follow-ups, and review
          preparation above.
        </p>
      </div>
    );
  }

  return (
    <ul className="relative divide-y divide-[#D1A866]/8">
      {notes.map((note) => {
        if (editingNoteId === note.id) {
          return null;
        }

        const canMutate =
          isAdmin || (currentUserId != null && note.advisorUserId === currentUserId);

        return (
          <AdvisorNoteCard
            key={note.id}
            note={note}
            canMutate={canMutate}
            deleting={deletingNoteId === note.id}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      })}
    </ul>
  );
}
