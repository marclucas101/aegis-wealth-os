/**
 * Phase 9F.4 disposable local promotion migration fixture.
 *
 * Commands:
 *   npx tsx scripts/phase9f4-migration-fixture.ts create
 *   npx tsx scripts/phase9f4-migration-fixture.ts print-id
 *   npx tsx scripts/phase9f4-migration-fixture.ts cleanup --confirm
 *
 * Safety: refuses non-local / non-allowlisted Supabase targets.
 */

import {
  assertLegacyPromotionsWriteDisabled,
  assertPhase9f4HarnessTargetAllowed,
  cleanupPhase9f4Fixture,
  PHASE9F4_FIXTURE_PROMOTION_ID,
  readFixtureState,
  upsertPhase9f4FixturePromotion,
} from "../lib/promotions/phase9f4MigrationLocalHarness";
import { createScriptAdminClient, loadDemoEnv } from "./seed-demo-data";

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/phase9f4-migration-fixture.ts create
  npx tsx scripts/phase9f4-migration-fixture.ts print-id
  npx tsx scripts/phase9f4-migration-fixture.ts cleanup --confirm`);
  process.exit(1);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    usage();
  }

  const { url } = loadDemoEnv();
  const target = assertPhase9f4HarnessTargetAllowed(url);
  const admin = createScriptAdminClient();

  console.log(`Phase 9F.4 migration fixture — target ${target.classification} (${target.host})\n`);

  await assertLegacyPromotionsWriteDisabled(admin);

  if (command === "create") {
    const state = await upsertPhase9f4FixturePromotion(admin);
    console.log("Fixture created (asset-free, disposable).");
    console.log(`promotion_id=${state.promotionId}`);
    console.log(`destination_id=${state.destinationId}`);
    return;
  }

  if (command === "print-id") {
    const state = readFixtureState();
    const promotionId = state?.promotionId ?? PHASE9F4_FIXTURE_PROMOTION_ID;
    console.log(promotionId);
    return;
  }

  if (command === "cleanup") {
    if (!rest.includes("--confirm")) {
      console.error("Cleanup aborted — pass --confirm to delete the disposable fixture only.");
      process.exit(1);
    }
    await cleanupPhase9f4Fixture(admin, { confirm: true });
    console.log("Fixture cleanup complete (promotion, review linkage, governed draft removed).");
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
