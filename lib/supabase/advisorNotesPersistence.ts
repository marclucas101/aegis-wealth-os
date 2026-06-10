import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type AdvisorNoteRow = {
  id: string;
  client_id: string;
  advisor_user_id: string;
  title: string | null;
  body: string;
  note_type?: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type AdvisorNotesAccessResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; client: AppClientRow };

export type AdvisorNoteMutationResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; note: AdvisorNoteRecord };

const DEFAULT_NOTE_TYPE: AdvisorNoteType = "general";

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function mapNoteType(value: string | null | undefined): AdvisorNoteType {
  if (
    value &&
    (ADVISOR_NOTE_TYPES as readonly string[]).includes(value)
  ) {
    return value as AdvisorNoteType;
  }

  return DEFAULT_NOTE_TYPE;
}

function mapNoteRow(row: AdvisorNoteRow): AdvisorNoteRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    advisorUserId: row.advisor_user_id,
    title: row.title,
    body: row.body,
    noteType: mapNoteType(row.note_type),
    isPinned: row.is_pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Rejects request bodies that attempt to supply identity fields from the browser.
 */
export function rejectForbiddenNoteFields(body: unknown): {
  rejected: boolean;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { rejected: false };
  }

  const forbidden = [
    "clientId",
    "client_id",
    "advisor_id",
    "advisor_user_id",
    "advisorId",
    "user_id",
    "userId",
  ] as const;

  for (const key of forbidden) {
    if (key in body) {
      return {
        rejected: true,
        error: `${key} must not be supplied by the client`,
      };
    }
  }

  return { rejected: false };
}

async function resolveAccessibleClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<AdvisorNotesAccessResult> {
  if (!isValidUuid(clientId)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client: ${error.message}`);
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  const client = data as AppClientRow;

  if (userRole === "advisor" && client.advisor_user_id !== authUserId) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, client };
}

async function loadNoteById(
  noteId: string,
): Promise<AdvisorNoteRow | null> {
  if (!isValidUuid(noteId)) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load advisor note: ${error.message}`);
  }

  return (data as AdvisorNoteRow | null) ?? null;
}

function canMutateNote(
  authUserId: string,
  userRole: "advisor" | "admin",
  note: AdvisorNoteRow,
): boolean {
  if (userRole === "admin") {
    return true;
  }

  return note.advisor_user_id === authUserId;
}

export async function listAdvisorNotesForClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; reason: "not_found" | "forbidden" }
  | { ok: true; notes: AdvisorNoteRecord[] }
> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (!access.ok) {
    return { ok: false, reason: access.reason };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list advisor notes: ${error.message}`);
  }

  return {
    ok: true,
    notes: ((data ?? []) as AdvisorNoteRow[]).map(mapNoteRow),
  };
}

export async function createAdvisorNote(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  input: {
    title: string | null;
    body: string;
    noteType: AdvisorNoteType;
  },
): Promise<AdvisorNoteMutationResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (!access.ok) {
    return { ok: false, reason: access.reason };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_notes")
    .insert({
      client_id: clientId,
      advisor_user_id: authUserId,
      title: input.title,
      body: input.body,
      note_type: input.noteType,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create advisor note: ${error.message}`);
  }

  return { ok: true, note: mapNoteRow(data as AdvisorNoteRow) };
}

export async function updateAdvisorNote(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  noteId: string,
  input: {
    title?: string | null;
    body?: string;
    noteType?: AdvisorNoteType;
  },
): Promise<AdvisorNoteMutationResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (!access.ok) {
    return { ok: false, reason: access.reason };
  }

  const existing = await loadNoteById(noteId);

  if (!existing || existing.client_id !== clientId) {
    return { ok: false, reason: "not_found" };
  }

  if (!canMutateNote(authUserId, userRole, existing)) {
    return { ok: false, reason: "forbidden" };
  }

  const patch: Record<string, unknown> = {};

  if ("title" in input) {
    patch.title = input.title;
  }

  if (input.body !== undefined) {
    patch.body = input.body;
  }

  if (input.noteType !== undefined) {
    patch.note_type = input.noteType;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, note: mapNoteRow(existing) };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("advisor_notes")
    .update(patch as never)
    .eq("id", noteId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update advisor note: ${error.message}`);
  }

  return { ok: true, note: mapNoteRow(data as AdvisorNoteRow) };
}

export async function deleteAdvisorNote(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  noteId: string,
): Promise<
  | { ok: false; reason: "not_found" | "forbidden" }
  | { ok: true; noteId: string; noteType: AdvisorNoteType }
> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (!access.ok) {
    return { ok: false, reason: access.reason };
  }

  const existing = await loadNoteById(noteId);

  if (!existing || existing.client_id !== clientId) {
    return { ok: false, reason: "not_found" };
  }

  if (!canMutateNote(authUserId, userRole, existing)) {
    return { ok: false, reason: "forbidden" };
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("advisor_notes").delete().eq("id", noteId);

  if (error) {
    throw new Error(`Failed to delete advisor note: ${error.message}`);
  }

  return {
    ok: true,
    noteId,
    noteType: mapNoteType(existing.note_type),
  };
}
