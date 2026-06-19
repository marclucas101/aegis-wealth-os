/**
 * Phase 9D analytics privacy scanner tests.
 */

import { assertActiveClientAuditMetadataSafe } from "../lib/compliance/activeClientAuditMetadata";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function runPhase9dAnalyticsPrivacyTests(): void {
  assertActiveClientAuditMetadataSafe({
    eventType: "financial_overview_viewed",
    outputType: "financial_overview",
    count: 1,
  });

  let rejected = false;
  try {
    assertActiveClientAuditMetadataSafe({
      eventType: "goal_created",
      monthlySurplus: 5000,
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "monthlySurplus rejected in audit metadata");

  rejected = false;
  try {
    assertActiveClientAuditMetadataSafe({
      eventType: "review_submitted",
      reviewPayload: { income: 100000 },
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "reviewPayload rejected in audit metadata");

  rejected = false;
  try {
    assertActiveClientAuditMetadataSafe({
      eventType: "published_plan_viewed",
      nested: { rawShieldScore: 88 },
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "nested rawShieldScore rejected");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runPhase9dAnalyticsPrivacyTests();
  console.log("Phase 9D analytics privacy tests passed.");
}
