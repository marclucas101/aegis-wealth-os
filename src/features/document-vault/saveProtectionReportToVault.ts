import { sanitizeReportFilenameBase } from "@/lib/reports/a4Print";
import { generateProtectionReportPdf } from "./generateProtectionReportPdf";
import type { ProtectionReportVaultMetadata } from "./types";

export type SaveProtectionReportResult =
  | {
      ok: true;
      documentId: string;
      fileName: string;
    }
  | {
      ok: false;
      error: string;
      reason?: "unauthenticated" | "forbidden" | "not_found" | "error";
    };

export async function saveProtectionReportToVault(params: {
  clientId: string;
  reportRootElement: HTMLElement;
  metadata: ProtectionReportVaultMetadata;
}): Promise<SaveProtectionReportResult> {
  const pdfBlob = await generateProtectionReportPdf(params.reportRootElement);
  const fileName = `${sanitizeReportFilenameBase(params.metadata.householdName)}-protection-summary.pdf`;
  const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

  const formData = new FormData();
  formData.append("file", pdfFile);
  formData.append(
    "metadata",
    JSON.stringify({
      householdName: params.metadata.householdName,
      primaryContact: params.metadata.primaryContact,
      statementPeriod: params.metadata.statementPeriod,
      adviserName: params.metadata.adviserName,
      adviserCompany: params.metadata.adviserCompany,
      policyCount: params.metadata.policyCount,
      totalCoverage: params.metadata.totalCoverage,
      monthlyPremium: params.metadata.monthlyPremium,
    }),
  );

  const response = await fetch(
    `/api/advisor/clients/${encodeURIComponent(params.clientId)}/documents/save-protection-report`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    },
  );

  const data = (await response.json()) as
    | { ok: true; document: { id: string; file_name: string } }
    | {
        ok: false;
        reason?: "unauthenticated" | "forbidden" | "not_found" | "error";
        error?: string;
      };

  if (!data.ok) {
    return {
      ok: false,
      error: data.error ?? "Failed to save report to Document Vault",
      reason: data.reason,
    };
  }

  return {
    ok: true,
    documentId: data.document.id,
    fileName: data.document.file_name,
  };
}
