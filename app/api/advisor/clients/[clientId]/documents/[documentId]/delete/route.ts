import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rejectClientIdInBody,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { deleteAdvisorClientDocument } from "@/lib/supabase/advisorDocumentPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdvisorDocumentDeleteResponse =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ clientId: string; documentId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorDocumentDeleteResponse>> {
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

    const parsed = await parseJsonBodySafely(request, { allowEmpty: true });
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    if (parsed.body !== null) {
      const clientIdReject = rejectClientIdInBody(parsed.body);
      if (clientIdReject.rejected) {
        return NextResponse.json(
          { ok: false, reason: "error", error: clientIdReject.error },
          { status: 400 },
        );
      }
    }

    const { clientId, documentId } = await context.params;
    const result = await deleteAdvisorClientDocument(
      access.authUser.id,
      role,
      clientId,
      documentId,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have access to this client"
              : "Document not found",
        },
        { status: result.reason === "forbidden" ? 403 : 404 },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_document_deleted",
      entityType: "documents",
      entityId: result.documentId,
      metadata: {
        client_id: clientId,
        document_id: result.documentId,
        category: result.auditMeta.category,
        file_type: result.auditMeta.fileType,
        file_size: result.auditMeta.fileSize,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, id: result.documentId });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to delete document");

    console.error(
      "[api/advisor/clients/[clientId]/documents/[documentId]/delete]",
      err,
    );

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
