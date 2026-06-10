import { NextResponse } from "next/server";

import {
  parseJsonBodySafely,
  rejectClientIdInBody,
  toPublicErrorMessage,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { createDocumentSignedUrl } from "@/lib/supabase/documentPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DocumentsSignedUrlRequestBody = {
  document_id: string;
};

export type DocumentsSignedUrlResponse =
  | { ok: true; signedUrl: string; expiresIn: number }
  | { ok: false; error: string };

export async function POST(
  request: Request,
): Promise<NextResponse<DocumentsSignedUrlResponse>> {
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

    const result = await createDocumentSignedUrl(
      session.client,
      documentIdResult.value,
    );

    return NextResponse.json({
      ok: true,
      signedUrl: result.signedUrl,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create signed URL");

    console.error("[api/documents/signed-url]", err);

    const status = message === "Document not found" ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
