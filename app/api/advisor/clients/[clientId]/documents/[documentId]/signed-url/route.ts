import { NextResponse } from "next/server";

import { getRequestMetadata, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { createAdvisorDocumentSignedUrl } from "@/lib/supabase/advisorDocumentAccess";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdvisorDocumentSignedUrlResponse =
  | { ok: true; signedUrl: string; expiresIn: number }
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
): Promise<NextResponse<AdvisorDocumentSignedUrlResponse>> {
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

    const { clientId, documentId } = await context.params;
    const result = await createAdvisorDocumentSignedUrl(
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
      action: "advisor_document_accessed",
      entityType: "document",
      entityId: documentId,
      metadata: {
        client_id: clientId,
        category: result.auditMeta.category,
        file_type: result.auditMeta.fileType,
        file_size: result.auditMeta.fileSize,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({
      ok: true,
      signedUrl: result.signedUrl,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create signed URL");
    console.error(
      "[api/advisor/clients/[clientId]/documents/[documentId]/signed-url]",
      err,
    );

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
