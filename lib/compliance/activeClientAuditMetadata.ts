/**
 * Sensitive metadata keys that must never appear in Phase 9D client portal audit events.
 * Used by static QA and runtime validation in recordActiveClientEvent.
 */

export const ACTIVE_CLIENT_AUDIT_SENSITIVE_KEYS = [
  "income",
  "expenditure",
  "expenses",
  "budgetSurplus",
  "monthlySurplus",
  "savingsCapacity",
  "assets",
  "liabilities",
  "netWorth",
  "protectionAmount",
  "coverageGap",
  "goalDescription",
  "goalTitle",
  "reviewAnswers",
  "reviewPayload",
  "documentContent",
  "adviserNotes",
  "internalNotes",
  "safe_payload",
  "rawShieldScore",
  "pillarScores",
  "formData",
] as const;

export function assertActiveClientAuditMetadataSafe(
  metadata: Record<string, unknown>,
  path = "metadata",
): void {
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    for (const sensitive of ACTIVE_CLIENT_AUDIT_SENSITIVE_KEYS) {
      if (lower.includes(sensitive.toLowerCase())) {
        throw new Error(`Sensitive audit metadata key prohibited: ${path}.${key}`);
      }
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      assertActiveClientAuditMetadataSafe(value as Record<string, unknown>, `${path}.${key}`);
    }
  }
}
