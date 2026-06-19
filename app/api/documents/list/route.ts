import { NextResponse } from "next/server";

import { assertClientDocumentAccess } from "@/lib/compliance/documentAccess";
import { isProspectStage } from "@/lib/compliance/relationshipStage";
import type { RelationshipStage } from "@/lib/compliance/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
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

function ctxIsProspect(stage: RelationshipStage): boolean {
  return isProspectStage(stage);
}

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

    const access = await assertClientDocumentAccess(session.user, session.client);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
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

    const documents = await listClientDocuments(session.client, category, {
      prospectMode: ctxIsProspect(session.client.relationship_stage),
      clientUserId: session.authUser.id,
    });

    return NextResponse.json({ ok: true, documents });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to list documents");

    console.error("[api/documents/list]", err);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
