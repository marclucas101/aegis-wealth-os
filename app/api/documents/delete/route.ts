import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rejectClientIdInBody,
  toPublicErrorMessage,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { deleteClientDocument } from "@/lib/supabase/documentPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DocumentsDeleteResponse =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function POST(
  request: Request,
): Promise<NextResponse<DocumentsDeleteResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid document_id" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const documentIdResult = validateRequiredString(
      body.document_id,
      "document_id",
    );
    if (!documentIdResult.ok) {
      return NextResponse.json(
        { ok: false, error: documentIdResult.error },
        { status: 400 },
      );
    }

    const result = await deleteClientDocument(
      session.client,
      documentIdResult.value,
    );

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "document_deleted",
      entityType: "documents",
      entityId: result.id,
      metadata: {
        document_id: result.id,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to delete document");

    console.error("[api/documents/delete]", err);

    const status = message === "Document not found" ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
