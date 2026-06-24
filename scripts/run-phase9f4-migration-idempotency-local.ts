/**
 * Phase 9F.4 local/staging acceptance — migration 012 idempotency harness.
 *
 * Run: npm run test:phase9f4-migration-idempotency-local
 *
 * Prerequisites:
 *   - Migration 202606200012 applied on target database
 *   - `npm run demo:seed` (admin reviewer user)
 *   - Local Supabase or allowlisted staging via PHASE9F4_MIGRATION_FIXTURE_ALLOWED_PROJECT_REFS
 */

import {
  assertLegacyPromotionsWriteDisabled,
  assertMigrationRpcAvailable,
  assertPhase9f4HarnessTargetAllowed,
  invokeFixtureMigrationRpc,
  loadFixturePromotionSnapshot,
  PHASE9F4_FIXTURE_PROMOTION_ID,
  readFixtureState,
  resolveHarnessReviewerUserId,
  upsertPhase9f4FixturePromotion,
} from "../lib/promotions/phase9f4MigrationLocalHarness";
import { legacyPromotionMigrationDestinationId } from "../lib/promotions/promotionMigrationIdempotency";
import { createScriptAdminClient, loadDemoEnv } from "./seed-demo-data";

type PromotionSnapshot = Record<string, unknown>;

function snapshotsEqual(before: PromotionSnapshot, after: PromotionSnapshot): boolean {
  const keys = [
    "title",
    "summary",
    "details",
    "category",
    "audience",
    "status",
    "priority",
    "image_url",
    "attachment_url",
    "created_by",
    "created_at",
    "updated_at",
  ] as const;

  for (const key of keys) {
    if (before[key] !== after[key]) {
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  const { url } = loadDemoEnv();
  const target = assertPhase9f4HarnessTargetAllowed(url);
  const admin = createScriptAdminClient();

  console.log("Phase 9F.4 migration idempotency local acceptance\n");
  console.log(`  Target: ${target.classification} (${target.host})`);
  if (target.projectRef) {
    console.log(`  Project ref: ${target.projectRef}`);
  }

  await assertLegacyPromotionsWriteDisabled(admin);
  await assertMigrationRpcAvailable(admin);

  const state = readFixtureState() ?? (await upsertPhase9f4FixturePromotion(admin));
  const expectedDestinationId = legacyPromotionMigrationDestinationId(
    PHASE9F4_FIXTURE_PROMOTION_ID,
  );

  if (state.destinationId !== expectedDestinationId) {
    throw new Error("Fixture state destination id does not match deterministic algorithm.");
  }

  console.log(`  Fixture promotion_id: ${state.promotionId}`);
  console.log(`  Expected destination_id: ${expectedDestinationId}`);

  const beforeSnapshot = await loadFixturePromotionSnapshot(admin);
  const reviewerUserId = await resolveHarnessReviewerUserId(admin);

  console.log("\nRunning two concurrent migration RPC requests…");
  const [first, second] = await Promise.all([
    invokeFixtureMigrationRpc(admin, reviewerUserId),
    invokeFixtureMigrationRpc(admin, reviewerUserId),
  ]);

  if (!first.ok || !second.ok) {
    throw new Error(
      `Concurrent migration failed: first=${first.ok ? first.outcome : first.reason}; second=${second.ok ? second.outcome : second.reason}`,
    );
  }

  if (!first.contentId || !second.contentId) {
    throw new Error("Concurrent migration did not return a governed destination id.");
  }

  if (first.contentId !== second.contentId) {
    throw new Error(
      `Destination UUID mismatch: ${first.contentId} vs ${second.contentId}`,
    );
  }

  if (first.contentId !== expectedDestinationId) {
    throw new Error(
      `Destination UUID does not match deterministic id: got ${first.contentId}, expected ${expectedDestinationId}`,
    );
  }

  const successOutcomes = new Set(["created", "reused", "already_migrated", "recovered_orphan"]);
  if (!successOutcomes.has(first.outcome) || !successOutcomes.has(second.outcome)) {
    throw new Error(`Unexpected migration outcomes: ${first.outcome}, ${second.outcome}`);
  }

  const atLeastOneReuse =
    first.reused ||
    second.reused ||
    first.outcome === "already_migrated" ||
    second.outcome === "already_migrated" ||
    first.outcome === "reused" ||
    second.outcome === "reused";

  if (first.outcome === "created" && second.outcome === "created" && !atLeastOneReuse) {
    throw new Error("Both concurrent requests reported created — idempotency failure.");
  }

  console.log(`  Concurrent outcomes: ${first.outcome}, ${second.outcome}`);
  console.log(`  Shared destination_id: ${first.contentId}`);

  const { count: governedCount, error: governedCountError } = await admin
    .from("governed_content")
    .select("id", { count: "exact", head: true })
    .eq("id", expectedDestinationId);

  if (governedCountError) {
    throw new Error(`Failed to count governed drafts: ${governedCountError.message}`);
  }

  if (governedCount !== 1) {
    throw new Error(`Expected exactly one governed draft, found ${governedCount ?? 0}.`);
  }

  const { data: governed, error: governedError } = await admin
    .from("governed_content")
    .select(
      "id, approval_status, published_at, scheduled_at, external_source_name, title",
    )
    .eq("id", expectedDestinationId)
    .maybeSingle();

  if (governedError || !governed) {
    throw new Error(`Failed to load governed draft: ${governedError?.message ?? "not found"}`);
  }

  if (governed.approval_status !== "draft") {
    throw new Error(`Governed draft must remain draft, got ${governed.approval_status}.`);
  }

  if (governed.published_at || governed.scheduled_at) {
    throw new Error("Governed draft must not be published or scheduled.");
  }

  if (governed.external_source_name !== "legacy_promotion") {
    throw new Error("Governed draft external_source_name must be legacy_promotion.");
  }

  const { count: notificationCount, error: notificationError } = await admin
    .from("client_notifications")
    .select("id", { count: "exact", head: true })
    .eq("communication_id", expectedDestinationId);

  if (notificationError) {
    throw new Error(`Failed to inspect notifications: ${notificationError.message}`);
  }

  if ((notificationCount ?? 0) > 0) {
    throw new Error(`Expected zero notifications for governed draft, found ${notificationCount}.`);
  }

  const afterSnapshot = await loadFixturePromotionSnapshot(admin);
  if (!snapshotsEqual(beforeSnapshot as PromotionSnapshot, afterSnapshot as PromotionSnapshot)) {
    throw new Error("Source promotion row changed during migration — source must remain unchanged.");
  }

  console.log("  Governed draft: exactly one draft row, no publish/schedule/notification");
  console.log("  Source promotion: unchanged");

  console.log("\nPASS — Phase 9F.4 migration idempotency local acceptance");
  console.log("\nCleanup (explicit confirmation required):");
  console.log("  npx tsx scripts/phase9f4-migration-fixture.ts cleanup --confirm");
}

main().catch((error) => {
  console.error("\nFAIL —", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
