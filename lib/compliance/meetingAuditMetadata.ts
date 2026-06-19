import "server-only";

/** Keys that must never appear in meeting audit or event metadata. */
export const MEETING_AUDIT_SENSITIVE_KEYS = [
  "rawShieldScore",
  "adjustedShieldScore",
  "annualIncome",
  "annual_income",
  "netWorth",
  "net_worth",
  "formData",
  "form_data",
  "coverageGap",
  "recommendedCoverage",
  "internalNotes",
  "internalAdviserNotes",
  "adviserNotes",
  "clientSafeSummaryText",
  "scenarioResult",
  "stressTest",
  "documentContent",
  "fullNote",
  "correctedValue",
  "currentValue",
] as const;

export function assertMeetingAuditMetadataSafe(
  metadata: Record<string, unknown>,
  path = "metadata",
): void {
  for (const key of Object.keys(metadata)) {
    if (
      MEETING_AUDIT_SENSITIVE_KEYS.some(
        (sensitive) =>
          key.toLowerCase() === sensitive.toLowerCase() ||
          key.toLowerCase().includes(sensitive.toLowerCase()),
      )
    ) {
      throw new Error(`Sensitive key in meeting audit metadata: ${path}.${key}`);
    }
    const value = metadata[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      assertMeetingAuditMetadataSafe(
        value as Record<string, unknown>,
        `${path}.${key}`,
      );
    }
  }
}

export function sanitizeMeetingAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  assertMeetingAuditMetadataSafe(metadata);
  return metadata;
}
