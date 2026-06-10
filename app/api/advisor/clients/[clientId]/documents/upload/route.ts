import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  rateLimitOrThrow,
  rejectClientIdInFormData,
  rejectUnexpectedFormFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { uploadAdvisorClientDocument } from "@/lib/supabase/advisorDocumentPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  DOCUMENT_CATEGORIES,
  isValidDocumentCategory,
  type DocumentCategory,
  type VaultDocumentRecord,
} from "@/lib/supabase/documentPersistence";

export const dynamic = "force-dynamic";

export type AdvisorDocumentUploadResponse =
  | { ok: true; document: VaultDocumentRecord }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ clientId: string }>;
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
): Promise<NextResponse<AdvisorDocumentUploadResponse>> {
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

    const rateLimit = rateLimitOrThrow<AdvisorDocumentUploadResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid form data" },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInFormData(formData);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFormFields(formData, {
      rejectClientId: true,
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: sensitiveReject.error },
        { status: 400 },
      );
    }

    const categoryResult = validateEnum(
      formData.get("category"),
      DOCUMENT_CATEGORIES,
      "category",
    );
    if (!categoryResult.ok || !isValidDocumentCategory(categoryResult.value)) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Missing or invalid category" },
        { status: 400 },
      );
    }

    const category = categoryResult.value as DocumentCategory;
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "A file is required" },
        { status: 400 },
      );
    }

    const { clientId } = await context.params;
    const result = await uploadAdvisorClientDocument(
      access.authUser.id,
      role,
      clientId,
      fileEntry,
      category,
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

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_document_uploaded",
      entityType: "documents",
      entityId: result.document.id,
      metadata: {
        client_id: clientId,
        document_id: result.document.id,
        category: result.document.category,
        file_type: result.document.file_type,
        file_size: result.document.file_size,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, document: result.document });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to upload document");

    console.error(
      "[api/advisor/clients/[clientId]/documents/upload]",
      err,
    );

    const status =
      message.includes("size limit") ||
      message.includes("not supported") ||
      message.includes("MIME type") ||
      message.includes("empty")
        ? 400
        : 500;

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status },
    );
  }
}
