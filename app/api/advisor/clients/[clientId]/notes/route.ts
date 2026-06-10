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
  createAdvisorNote,
  listAdvisorNotesForClient,
  rejectForbiddenNoteFields,
  type AdvisorNoteRecord,
  type AdvisorNoteType,
} from "@/lib/supabase/advisorNotesPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdvisorNotesListResponse =
  | {
      ok: true;
      notes: AdvisorNoteRecord[];
      viewer: { userId: string; role: "advisor" | "admin" };
    }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

export type AdvisorNotesCreateResponse =
  | { ok: true; note: AdvisorNoteRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

function advisorRole(
  role: string,
): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorNotesListResponse>> {
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

    const { clientId } = await context.params;
    const result = await listAdvisorNotesForClient(
      access.authUser.id,
      role,
      clientId,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have access to this client"
              : "Client not found",
        },
        { status: result.reason === "forbidden" ? 403 : 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      notes: result.notes,
      viewer: { userId: access.authUser.id, role },
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load advisor notes");
    console.error("[api/advisor/clients/[clientId]/notes GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorNotesCreateResponse>> {
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
    const bodyResult = validateRequiredString(body.body, "body");
    if (!bodyResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: bodyResult.error },
        { status: 400 },
      );
    }

    const noteTypeResult = validateEnum<AdvisorNoteType>(
      body.note_type ?? body.noteType ?? "general",
      ADVISOR_NOTE_TYPES,
      "note_type",
    );
    if (!noteTypeResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: noteTypeResult.error },
        { status: 400 },
      );
    }

    let title: string | null = null;
    if (body.title !== undefined && body.title !== null) {
      if (typeof body.title !== "string") {
        return NextResponse.json(
          { ok: false, reason: "error", error: "Missing or invalid title" },
          { status: 400 },
        );
      }

      title = body.title.trim() || null;
    }

    const { clientId } = await context.params;
    const result = await createAdvisorNote(access.authUser.id, role, clientId, {
      title,
      body: bodyResult.value,
      noteType: noteTypeResult.value,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have access to this client"
              : "Client not found",
        },
        { status: result.reason === "forbidden" ? 403 : 404 },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_note_created",
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

    return NextResponse.json({ ok: true, note: result.note }, { status: 201 });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create advisor note");
    console.error("[api/advisor/clients/[clientId]/notes POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
