import { NextResponse } from "next/server";

import {
  isValidDocumentCategory,
  listClientDocuments,
  type DocumentCategory,
  type VaultDocumentRecord,
} from "@/lib/supabase/documentPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DocumentsListResponse =
  | { ok: true; documents: VaultDocumentRecord[] }
  | { ok: false; error: string };

export async function GET(
  request: Request,
): Promise<NextResponse<DocumentsListResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category");

    let category: DocumentCategory | null = null;
    if (categoryParam) {
      if (!isValidDocumentCategory(categoryParam)) {
        return NextResponse.json(
          { ok: false, error: "Invalid category filter" },
          { status: 400 },
        );
      }
      category = categoryParam;
    }

    const documents = await listClientDocuments(session.client, category);

    return NextResponse.json({ ok: true, documents });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list documents";

    console.error("[api/documents/list]", message);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
