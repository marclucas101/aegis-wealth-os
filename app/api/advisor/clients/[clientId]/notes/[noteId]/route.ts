import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  ADVISOR_NOTE_TYPES,
  deleteAdvisorNote,
  rejectForbiddenNoteFields,
  updateAdvisorNote,
  type AdvisorNoteRecord,
  type AdvisorNoteType,
} from "@/lib/supabase/advisorNotesPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdvisorNoteUpdateResponse =
  | { ok: true; note: AdvisorNoteRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

export type AdvisorNoteDeleteResponse =
  | { ok: true; noteId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

type RouteContext = {
  params: Promise<{ clientId: string; noteId: string }>;
};

function advisorRole(
  role: string,
): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorNoteUpdateResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectForbiddenNoteFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: forbidden.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const patch: {
      title?: string | null;
      body?: string;
      noteType?: AdvisorNoteType;
    } = {};

    if ("title" in body) {
      if (body.title !== null && typeof body.title !== "string") {
        return NextResponse.json(
          { ok: false, reason: "error", error: "Missing or invalid title" },
          { status: 400 },
        );
      }

      patch.title =
        body.title === null ? null : (body.title as string).trim() || null;
    }

    if ("body" in body) {
      const bodyResult = validateRequiredString(body.body, "body");
      if (!bodyResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: bodyResult.error },
          { status: 400 },
        );
      }

      patch.body = bodyResult.value;
    }

    if ("note_type" in body || "noteType" in body) {
      const noteTypeResult = validateEnum<AdvisorNoteType>(
        body.note_type ?? body.noteType,
        ADVISOR_NOTE_TYPES,
        "note_type",
      );
      if (!noteTypeResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: noteTypeResult.error },
          { status: 400 },
        );
      }

      patch.noteType = noteTypeResult.value;
    }

    if (
      !("title" in patch) &&
      patch.body === undefined &&
      patch.noteType === undefined
    ) {
      return NextResponse.json(
        {
          ok: false,
          reason: "error",
          error: "At least one field (title, body, note_type) is required",
        },
        { status: 400 },
      );
    }

    const { clientId, noteId } = await context.params;
    const result = await updateAdvisorNote(
      access.authUser.id,
      role,
      clientId,
      noteId,
      patch,
    );

    if (!result.ok) {
      const status =
        result.reason === "forbidden"
          ? 403
          : result.reason === "not_found"
            ? 404
            : 500;

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have permission to edit this note"
              : "Note not found",
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_note_updated",
      entityType: "advisor_notes",
      entityId: result.note.id,
      metadata: {
        note_type: result.note.noteType,
        client_id: clientId,
        note_id: result.note.id,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, note: result.note });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update advisor note");
    console.error("[api/advisor/clients/[clientId]/notes/[noteId] PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorNoteDeleteResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const { clientId, noteId } = await context.params;
    const result = await deleteAdvisorNote(
      access.authUser.id,
      role,
      clientId,
      noteId,
    );

    if (!result.ok) {
      const status =
        result.reason === "forbidden"
          ? 403
          : result.reason === "not_found"
            ? 404
            : 500;

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have permission to delete this note"
              : "Note not found",
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(_request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_note_deleted",
      entityType: "advisor_notes",
      entityId: result.noteId,
      metadata: {
        note_type: result.noteType,
        client_id: clientId,
        note_id: result.noteId,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, noteId: result.noteId });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to delete advisor note");
    console.error("[api/advisor/clients/[clientId]/notes/[noteId] DELETE]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
