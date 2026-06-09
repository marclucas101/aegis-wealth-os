import { NextResponse } from "next/server";

import { deleteClientDocument } from "@/lib/supabase/documentPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DocumentsDeleteRequestBody = {
  document_id: string;
};

export type DocumentsDeleteResponse =
  | { ok: true; id: string }
  | { ok: false; error: string };

function isValidDeleteBody(body: unknown): body is DocumentsDeleteRequestBody {
  if (!body || typeof body !== "object") return false;

  const candidate = body as DocumentsDeleteRequestBody;
  return (
    typeof candidate.document_id === "string" &&
    candidate.document_id.trim().length > 0
  );
}

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

    if (!isValidDeleteBody(body)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid document_id" },
        { status: 400 },
      );
    }

    const result = await deleteClientDocument(
      session.client,
      body.document_id.trim(),
    );

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete document";

    console.error("[api/documents/delete]", message);

    const status = message === "Document not found" ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
