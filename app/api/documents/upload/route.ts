import { NextResponse } from "next/server";

import {
  isValidDocumentCategory,
  uploadClientDocument,
  type DocumentCategory,
  type VaultDocumentRecord,
} from "@/lib/supabase/documentPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DocumentsUploadResponse =
  | { ok: true; document: VaultDocumentRecord }
  | { ok: false; error: string };

export async function POST(
  request: Request,
): Promise<NextResponse<DocumentsUploadResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid form data" },
        { status: 400 },
      );
    }

    if (formData.has("client_id") || formData.has("clientId")) {
      return NextResponse.json(
        { ok: false, error: "client_id must not be supplied by the client" },
        { status: 400 },
      );
    }

    const categoryValue = formData.get("category");
    if (!isValidDocumentCategory(categoryValue)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid category" },
        { status: 400 },
      );
    }

    const category = categoryValue as DocumentCategory;
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "A file is required" },
        { status: 400 },
      );
    }

    const document = await uploadClientDocument(
      session.client,
      session.authUser.id,
      fileEntry,
      category,
    );

    return NextResponse.json({ ok: true, document });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload document";

    console.error("[api/documents/upload]", message);

    const status =
      message.includes("size limit") ||
      message.includes("not supported") ||
      message.includes("MIME type") ||
      message.includes("empty")
        ? 400
        : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
