import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  rateLimitOrThrow,
  rejectClientIdInFormData,
  rejectUnexpectedFormFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  DOCUMENT_CATEGORIES,
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

    const rateLimit = rateLimitOrThrow<DocumentsUploadResponse>(request, {
      userId: session.authUser.id,
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
        { ok: false, error: "Invalid form data" },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInFormData(formData);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFormFields(formData);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
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
        { ok: false, error: "Missing or invalid category" },
        { status: 400 },
      );
    }

    const category = categoryResult.value as DocumentCategory;
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

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "document_uploaded",
      entityType: "documents",
      entityId: document.id,
      metadata: {
        category,
        file_size: document.file_size,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, document });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to upload document");

    console.error("[api/documents/upload]", err);

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
