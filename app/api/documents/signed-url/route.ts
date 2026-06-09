import { NextResponse } from "next/server";

import { createDocumentSignedUrl } from "@/lib/supabase/documentPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DocumentsSignedUrlRequestBody = {
  document_id: string;
};

export type DocumentsSignedUrlResponse =
  | { ok: true; signedUrl: string; expiresIn: number }
  | { ok: false; error: string };

function isValidSignedUrlBody(
  body: unknown,
): body is DocumentsSignedUrlRequestBody {
  if (!body || typeof body !== "object") return false;

  const candidate = body as DocumentsSignedUrlRequestBody;
  return (
    typeof candidate.document_id === "string" &&
    candidate.document_id.trim().length > 0
  );
}

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (
      body &&
      typeof body === "object" &&
      ("clientId" in body || "client_id" in body)
    ) {
      return NextResponse.json(
        { ok: false, error: "client_id must not be supplied by the client" },
        { status: 400 },
      );
    }

    if (!isValidSignedUrlBody(body)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid document_id" },
        { status: 400 },
      );
    }

    const result = await createDocumentSignedUrl(
      session.client,
      body.document_id.trim(),
    );

    return NextResponse.json({
      ok: true,
      signedUrl: result.signedUrl,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create signed URL";

    console.error("[api/documents/signed-url]", message);

    const status = message === "Document not found" ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
