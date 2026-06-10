/**
 * Phase 4Y — Remove demo seed data only.
 * Deletes records tied to @aegis-demo.local accounts.
 *
 * Run: npm run demo:clear -- --confirm
 */

import {
  createScriptAdminClient,
  DEMO_EMAIL_DOMAIN,
  isDemoEmail,
} from "./seed-demo-data";

const CONFIRM_FLAG = "--confirm";

function printWarning(): void {
  console.log("");
  console.log("=".repeat(72));
  console.log("  WARNING: DEMO DATA CLEAR");
  console.log("=".repeat(72));
  console.log("");
  console.log("  This script PERMANENTLY deletes all data linked to demo accounts");
  console.log(`  using the @${DEMO_EMAIL_DOMAIN} email domain.`);
  console.log("");
  console.log("  It will NOT delete non-demo users, clients, or production data.");
  console.log("  Storage files are NOT removed (metadata-only demo documents).");
  console.log("");
  console.log("  Re-run only when you intend to reset the demo environment.");
  console.log("");
  console.log(`  To proceed, pass the ${CONFIRM_FLAG} flag:`);
  console.log("    npm run demo:clear -- --confirm");
  console.log("");
  console.log("=".repeat(72));
  console.log("");
}

async function listDemoAuthUserIds(
  admin: ReturnType<typeof createScriptAdminClient>,
): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);

    for (const user of data.users) {
      if (isDemoEmail(user.email)) {
        ids.push(user.id);
      }
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return ids;
}

async function listDemoClientIds(
  admin: ReturnType<typeof createScriptAdminClient>,
  demoUserIds: string[],
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: byEmail, error: emailError } = await admin
    .from("clients")
    .select("id")
    .ilike("email", `%@${DEMO_EMAIL_DOMAIN}`);

  if (emailError) {
    throw new Error(`Failed to list demo clients by email: ${emailError.message}`);
  }

  for (const row of byEmail ?? []) {
    ids.add((row as { id: string }).id);
  }

  if (demoUserIds.length > 0) {
    const { data: byUser, error: userError } = await admin
      .from("clients")
      .select("id")
      .or(
        `user_id.in.(${demoUserIds.join(",")}),advisor_user_id.in.(${demoUserIds.join(",")})`,
      );

    if (userError) {
      throw new Error(`Failed to list demo clients by user: ${userError.message}`);
    }

    for (const row of byUser ?? []) {
      ids.add((row as { id: string }).id);
    }
  }

  return [...ids];
}

async function deleteByClientIds(
  admin: ReturnType<typeof createScriptAdminClient>,
  table: string,
  clientIds: string[],
  column = "client_id",
): Promise<number> {
  if (clientIds.length === 0) return 0;

  const { data, error } = await admin
    .from(table)
    .delete()
    .in(column, clientIds)
    .select("id");

  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`);
  }

  return data?.length ?? 0;
}

async function deleteDemoDocuments(
  admin: ReturnType<typeof createScriptAdminClient>,
  clientIds: string[],
): Promise<number> {
  if (clientIds.length === 0) return 0;

  const { data, error } = await admin
    .from("documents")
    .delete()
    .in("client_id", clientIds)
    .like("storage_path", "demo/%")
    .select("id");

  if (error) {
    throw new Error(`Failed to delete demo documents: ${error.message}`);
  }

  return data?.length ?? 0;
}

async function deleteAuditLogs(
  admin: ReturnType<typeof createScriptAdminClient>,
  demoUserIds: string[],
  clientIds: string[],
): Promise<number> {
  let removed = 0;

  const { data: byMeta, error: metaError } = await admin
    .from("audit_logs")
    .delete()
    .contains("metadata", { demo: true } as never)
    .select("id");

  if (metaError) {
    throw new Error(`Failed to delete demo audit logs: ${metaError.message}`);
  }
  removed += byMeta?.length ?? 0;

  if (demoUserIds.length > 0) {
    const { data: byUser, error: userError } = await admin
      .from("audit_logs")
      .delete()
      .in("user_id", demoUserIds)
      .select("id");

    if (userError) {
      throw new Error(`Failed to delete audit logs by user: ${userError.message}`);
    }
    removed += byUser?.length ?? 0;
  }

  if (clientIds.length > 0) {
    const { data: byClient, error: clientError } = await admin
      .from("audit_logs")
      .delete()
      .in("client_id", clientIds)
      .select("id");

    if (clientError) {
      throw new Error(`Failed to delete audit logs by client: ${clientError.message}`);
    }
    removed += byClient?.length ?? 0;
  }

  return removed;
}

async function deleteAdvisorTasks(
  admin: ReturnType<typeof createScriptAdminClient>,
  demoUserIds: string[],
  clientIds: string[],
): Promise<number> {
  let removed = 0;

  if (clientIds.length > 0) {
    const { data, error } = await admin
      .from("advisor_tasks")
      .delete()
      .in("client_id", clientIds)
      .select("id");
    if (error) throw new Error(`Failed to delete advisor tasks: ${error.message}`);
    removed += data?.length ?? 0;
  }

  if (demoUserIds.length > 0) {
    const { data, error } = await admin
      .from("advisor_tasks")
      .delete()
      .in("assigned_to_user_id", demoUserIds)
      .select("id");
    if (error) {
      throw new Error(`Failed to delete advisor tasks by assignee: ${error.message}`);
    }
    removed += data?.length ?? 0;
  }

  return removed;
}

async function deleteShieldChildren(
  admin: ReturnType<typeof createScriptAdminClient>,
  clientIds: string[],
): Promise<void> {
  if (clientIds.length === 0) return;

  const { data: shieldRows, error: shieldError } = await admin
    .from("shield_scores")
    .select("id")
    .in("client_id", clientIds);

  if (shieldError) {
    throw new Error(`Failed to list shield scores: ${shieldError.message}`);
  }

  const shieldIds = (shieldRows ?? []).map((row) => (row as { id: string }).id);
  if (shieldIds.length === 0) return;

  const childTables = ["pillar_scores", "stress_tests"] as const;
  for (const table of childTables) {
    const { error } = await admin.from(table).delete().in("shield_score_id", shieldIds);
    if (error) {
      throw new Error(`Failed to delete ${table}: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  printWarning();

  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.log("Aborted — confirmation flag not provided.\n");
    process.exit(1);
  }

  console.log("Clearing demo data…\n");

  const admin = createScriptAdminClient();
  const demoUserIds = await listDemoAuthUserIds(admin);
  const demoClientIds = await listDemoClientIds(admin, demoUserIds);

  console.log(`  Found ${demoUserIds.length} demo auth user(s)`);
  console.log(`  Found ${demoClientIds.length} demo client record(s)\n`);

  const counts: Record<string, number> = {};

  counts.audit_logs = await deleteAuditLogs(admin, demoUserIds, demoClientIds);
  counts.advisor_tasks = await deleteAdvisorTasks(admin, demoUserIds, demoClientIds);
  counts.advisor_notes = await deleteByClientIds(admin, "advisor_notes", demoClientIds);
  counts.documents = await deleteDemoDocuments(admin, demoClientIds);
  counts.wealth_blueprints = await deleteByClientIds(admin, "wealth_blueprints", demoClientIds);
  counts.annual_reviews = await deleteByClientIds(admin, "annual_reviews", demoClientIds);
  counts.roadmap_items = await deleteByClientIds(admin, "roadmap_items", demoClientIds);

  await deleteShieldChildren(admin, demoClientIds);
  counts.shield_scores = await deleteByClientIds(admin, "shield_scores", demoClientIds);
  counts.financial_profiles = await deleteByClientIds(
    admin,
    "financial_profiles",
    demoClientIds,
  );
  counts.client_profiles = await deleteByClientIds(admin, "client_profiles", demoClientIds);
  counts.discover_profiles = await deleteByClientIds(admin, "discover_profiles", demoClientIds);
  counts.clients = await deleteByClientIds(admin, "clients", demoClientIds, "id");

  if (demoUserIds.length > 0) {
    const { data: usersDeleted, error: usersError } = await admin
      .from("users")
      .delete()
      .in("id", demoUserIds)
      .select("id");

    if (usersError) {
      throw new Error(`Failed to delete public users: ${usersError.message}`);
    }
    counts.users = usersDeleted?.length ?? 0;
  }

  let authDeleted = 0;
  for (const userId of demoUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.log(`  WARN could not delete auth user ${userId}: ${error.message}`);
    } else {
      authDeleted += 1;
    }
  }
  counts.auth_users = authDeleted;

  for (const [table, count] of Object.entries(counts)) {
    if (count > 0) {
      console.log(`  DEL  ${table}: ${count}`);
    }
  }

  console.log("\nDemo clear complete. Run npm run demo:seed to recreate demo data.");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nDemo clear failed: ${message}`);
  process.exit(1);
});
