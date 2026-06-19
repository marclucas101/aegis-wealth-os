/**
 * Unit tests for client-safe DTO allowlist (no server-only dependency).
 * Invoked from run-phase9a-access-validation.ts case 10 supplement.
 */

import {
  buildFinancialReadinessSnapshotFromInternal,
  sanitizeFinancialReadinessPayload,
} from "../lib/compliance/clientSafeDtos";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function runClientSafeDtoNegativeTests(): void {
  const safe = buildFinancialReadinessSnapshotFromInternal({
    rating: "BBB",
    strongestPillar: "foundation",
    weakestPillar: "protect",
    informationCompletenessPercent: 72,
    dataAsAt: "2026-06-20",
    hasAssignedAdviser: true,
  });

  const sanitized = sanitizeFinancialReadinessPayload(
    safe as unknown as Record<string, unknown>,
  );
  assert(!("shield" in sanitized), "no shield in DTO");

  let unknownKeyRejected = false;
  try {
    sanitizeFinancialReadinessPayload({
      readinessBand: "moderate_readiness",
      broadStrengths: [],
      areasForAdviserReview: [],
      informationCompletenessPercent: 50,
      educationalExplanation: "test",
      dataAsAt: "2026-06-20",
      adviserReviewStatus: "pending",
      lastReviewedDate: null,
      nextRecommendedAdministrativeStep: "step",
      appointmentCta: null,
      missingInformationCategories: [],
      metadata: { shield: { rawShieldScore: 90 } },
    } as Record<string, unknown>);
  } catch {
    unknownKeyRejected = true;
  }
  assert(unknownKeyRejected, "unknown top-level key rejected");

  let ctaKeyRejected = false;
  try {
    sanitizeFinancialReadinessPayload({
      readinessBand: "moderate_readiness",
      broadStrengths: ["x"],
      areasForAdviserReview: [],
      informationCompletenessPercent: 50,
      educationalExplanation: "test",
      dataAsAt: "2026-06-20",
      adviserReviewStatus: "pending",
      lastReviewedDate: null,
      nextRecommendedAdministrativeStep: "step",
      appointmentCta: { label: "x", href: "/my-adviser", shield: 1 },
      missingInformationCategories: [],
    } as Record<string, unknown>);
  } catch {
    ctaKeyRejected = true;
  }
  assert(ctaKeyRejected, "prohibited nested appointmentCta key rejected");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runClientSafeDtoNegativeTests();
  console.log("Client-safe DTO negative tests passed.");
}
