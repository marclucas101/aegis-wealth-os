/**
 * Sensitive marker strings used in automated redaction tests.
 * These must never appear in binder render models or generated PDF text.
 */
export const BINDER_SENSITIVE_MARKERS = [
  "SENSITIVE_NRIC_S1234567A",
  "SENSITIVE_ACCOUNT_9988776655",
  "SENSITIVE_POLICY_POL-XY-009988",
  "SENSITIVE_EMAIL_leak@internal.example",
  "SENSITIVE_STORAGE_clients/secret/path.pdf",
  "SENSITIVE_DB_ID_00000000-0000-4000-8000-00000000dead",
  "SENSITIVE_ADVISER_NOTE_DO_NOT_SHARE",
  "SENSITIVE_COMPLIANCE_FLAG_INTERNAL",
  "SENSITIVE_SHIELD_RAW_42.918273",
  "SENSITIVE_AWRI_COEFF_0.87321",
] as const;

export function buildSensitiveFixturePayload(): Record<string, unknown> {
  return {
    nric: BINDER_SENSITIVE_MARKERS[0],
    accountNumber: BINDER_SENSITIVE_MARKERS[1],
    policyNumber: BINDER_SENSITIVE_MARKERS[2],
    email: BINDER_SENSITIVE_MARKERS[3],
    storage_path: BINDER_SENSITIVE_MARKERS[4],
    internalId: BINDER_SENSITIVE_MARKERS[5],
    adviserNotes: BINDER_SENSITIVE_MARKERS[6],
    complianceNotes: BINDER_SENSITIVE_MARKERS[7],
    rawShieldScore: BINDER_SENSITIVE_MARKERS[8],
    awri: BINDER_SENSITIVE_MARKERS[9],
    html: "<script>alert(1)</script>",
  };
}
