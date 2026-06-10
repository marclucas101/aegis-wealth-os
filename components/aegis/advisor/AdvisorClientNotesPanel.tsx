"use client";

import { useEffect, useState } from "react";

import AdvisorNoteComposer, {
  noteToComposerValues,
  type AdvisorNoteRecord,
  type NoteComposerValues,
} from "@/components/aegis/advisor/AdvisorNoteComposer";
import AdvisorNoteList from "@/components/aegis/advisor/AdvisorNoteList";

type SaveState = "idle" | "saved" | "error";

interface AdvisorClientNotesPanelProps {
  clientId: string;
  initialNotes: AdvisorNoteRecord[] | null;
  error: string | null;
  viewer: { userId: string; role: "advisor" | "admin" } | null;
  onRetry?: () => void;
}

export default function AdvisorClientNotesPanel({
  clientId,
  initialNotes,
  error,
  viewer,
  onRetry,
}: AdvisorClientNotesPanelProps) {
  const [notes, setNotes] = useState<AdvisorNoteRecord[]>(initialNotes ?? []);
  const [loadError, setLoadError] = useState<string | null>(error);

  const [creating, setCreating] = useState(false);
  const [createSaveState, setCreateSaveState] = useState<SaveState>("idle");
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingNote, setEditingNote] = useState<AdvisorNoteRecord | null>(
    null,
  );
  const [updating, setUpdating] = useState(false);
  const [updateSaveState, setUpdateSaveState] = useState<SaveState>("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [composerResetKey, setComposerResetKey] = useState(0);

  const isLoading = initialNotes === null && error === null;
  const currentUserId = viewer?.userId ?? null;
  const isAdmin = viewer?.role === "admin";

  useEffect(() => {
    if (initialNotes !== null) {
      setNotes(initialNotes);
    }
    setLoadError(error);
  }, [initialNotes, error]);

  async function handleCreate(values: NoteComposerValues) {
    setCreating(true);
    setCreateSaveState("idle");
    setCreateError(null);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticNote: AdvisorNoteRecord = {
      id: optimisticId,
      clientId,
      advisorUserId: currentUserId ?? "",
      title: values.title || null,
      body: values.body,
      noteType: values.noteType,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNotes((current) => [optimisticNote, ...current]);

    try {
      const response = await fetch(`/api/advisor/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title || null,
          body: values.body,
          note_type: values.noteType,
        }),
      });

      const data = (await response.json()) as
        | { ok: true; note: AdvisorNoteRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setNotes((current) => current.filter((note) => note.id !== optimisticId));
        setCreateSaveState("error");
        setCreateError(data.ok ? "Failed to save note." : (data.error ?? "Failed to save note."));
        return;
      }

      setNotes((current) =>
        current.map((note) => (note.id === optimisticId ? data.note : note)),
      );
      setCreateSaveState("saved");
      setComposerResetKey((key) => key + 1);
      window.setTimeout(() => setCreateSaveState("idle"), 2000);
    } catch {
      setNotes((current) => current.filter((note) => note.id !== optimisticId));
      setCreateSaveState("error");
      setCreateError("Failed to save note.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(values: NoteComposerValues) {
    if (!editingNote) return;

    setUpdating(true);
    setUpdateSaveState("idle");
    setUpdateError(null);

    const previousNotes = notes;
    const noteId = editingNote.id;

    setNotes((current) =>
      current.map((note) =>
        note.id === noteId
          ? {
              ...note,
              title: values.title || null,
              body: values.body,
              noteType: values.noteType,
              updatedAt: new Date().toISOString(),
            }
          : note,
      ),
    );

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/notes/${noteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: values.title || null,
            body: values.body,
            note_type: values.noteType,
          }),
        },
      );

      const data = (await response.json()) as
        | { ok: true; note: AdvisorNoteRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setNotes(previousNotes);
        setUpdateSaveState("error");
        setUpdateError(
          data.ok ? "Failed to update note." : (data.error ?? "Failed to update note."),
        );
        return;
      }

      setNotes((current) =>
        current.map((note) => (note.id === noteId ? data.note : note)),
      );
      setEditingNote(null);
      setUpdateSaveState("saved");
      window.setTimeout(() => setUpdateSaveState("idle"), 2000);
    } catch {
      setNotes(previousNotes);
      setUpdateSaveState("error");
      setUpdateError("Failed to update note.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingNoteId(noteId);
    setDeleteError(null);

    const previousNotes = notes;
    setNotes((current) => current.filter((note) => note.id !== noteId));

    if (editingNote?.id === noteId) {
      setEditingNote(null);
    }

    try {
      const response = await fetch(
        `/api/advisor/clients/${clientId}/notes/${noteId}`,
        { method: "DELETE" },
      );

      const data = (await response.json()) as
        | { ok: true; noteId: string }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setNotes(previousNotes);
        setDeleteError(data.ok ? "Failed to delete note." : (data.error ?? "Failed to delete note."));
      }
    } catch {
      setNotes(previousNotes);
      setDeleteError("Failed to delete note.");
    } finally {
      setDeletingNoteId(null);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Advisor Notes
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Meeting summaries, follow-ups, risk observations, and review preparation
        </p>
      </div>

      <div className="relative space-y-6 px-5 py-5">
        {isLoading ? (
          <p className="text-sm font-light text-[#F3F1EA]/45">
            Loading notes…
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-4 py-3">
            <p className="text-sm font-light text-red-200/80">
              {loadError ?? "Unable to load notes."}
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 text-[11px] uppercase tracking-[0.12em] text-[#D1A866]/80 hover:text-[#D1A866]"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !loadError ? (
          <>
            <AdvisorNoteComposer
              key={composerResetKey}
              mode="create"
              saving={creating}
              saveState={createSaveState}
              errorMessage={createError}
              onSubmit={handleCreate}
            />

            {deleteError ? (
              <p className="text-sm font-light text-red-200/80">{deleteError}</p>
            ) : null}

            {editingNote ? (
              <div className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/30 p-4">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70">
                  Edit Note
                </p>
                <AdvisorNoteComposer
                  mode="edit"
                  initialValues={noteToComposerValues(editingNote)}
                  saving={updating}
                  saveState={updateSaveState}
                  errorMessage={updateError}
                  onSubmit={handleUpdate}
                  onCancel={() => {
                    setEditingNote(null);
                    setUpdateSaveState("idle");
                    setUpdateError(null);
                  }}
                />
              </div>
            ) : null}

            <div>
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/40">
                Recent Notes
              </p>
              <AdvisorNoteList
                notes={notes}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                editingNoteId={editingNote?.id ?? null}
                deletingNoteId={deletingNoteId}
                onEdit={setEditingNote}
                onDelete={handleDelete}
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
