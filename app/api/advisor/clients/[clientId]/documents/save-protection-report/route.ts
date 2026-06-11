import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  rateLimitOrThrow,
  rejectClientIdInFormData,
  rejectUnexpectedFormFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  uploadAdvisorProtectionReport,
  type ProtectionReportVaultMetadata,
} from "@/lib/supabase/advisorDocumentPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import type { VaultDocumentRecord } from "@/lib/supabase/documentPersistence";

export const dynamic = "force-dynamic";

export type SaveProtectionReportResponse =
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

function parseMetadata(raw: FormDataEntryValue | null): ProtectionReportVaultMetadata | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProtectionReportVaultMetadata>;
    if (
      typeof parsed.householdName !== "string" ||
      typeof parsed.primaryContact !== "string" ||
      typeof parsed.statementPeriod !== "string" ||
      typeof parsed.adviserName !== "string" ||
      typeof parsed.adviserCompany !== "string" ||
      typeof parsed.policyCount !== "number" ||
      typeof parsed.totalCoverage !== "number" ||
      typeof parsed.monthlyPremium !== "number"
    ) {
      return null;
    }

    return {
      householdName: parsed.householdName.trim(),
      primaryContact: parsed.primaryContact.trim(),
      statementPeriod: parsed.statementPeriod.trim(),
      adviserName: parsed.adviserName.trim(),
      adviserCompany: parsed.adviserCompany.trim(),
      policyCount: parsed.policyCount,
      totalCoverage: parsed.totalCoverage,
      monthlyPremium: parsed.monthlyPremium,
    };
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<SaveProtectionReportResponse>> {
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

    const rateLimit = rateLimitOrThrow<SaveProtectionReportResponse>(request, {
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

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "A PDF file is required" },
        { status: 400 },
      );
    }

    const metadata = parseMetadata(formData.get("metadata"));
    if (!metadata) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid report metadata" },
        { status: 400 },
      );
    }

    const { clientId } = await context.params;
    const result = await uploadAdvisorProtectionReport(
      access.authUser.id,
      role,
      clientId,
      fileEntry,
      metadata,
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

    const requestMetadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_protection_report_saved",
      entityType: "documents",
      entityId: result.document.id,
      metadata: {
        client_id: clientId,
        document_id: result.document.id,
        household_name: metadata.householdName,
        statement_period: metadata.statementPeriod,
        policy_count: metadata.policyCount,
        file_size: result.document.file_size,
      },
      ipAddress: requestMetadata.ip_address,
      userAgent: requestMetadata.user_agent,
    });

    return NextResponse.json({ ok: true, document: result.document });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to save protection report");

    console.error(
      "[api/advisor/clients/[clientId]/documents/save-protection-report]",
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
