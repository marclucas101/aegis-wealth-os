/**
 * Phase 7 — READ-ONLY duplicate `clients` row audit.
 *
 * Detects auth users that own more than one `public.clients` row and reports the
 * linked-data footprint of each duplicate so a safe canonical row can be chosen
 * before applying a uniqueness constraint. This script never writes or deletes.
 *
 * Usage (against staging first, then production):
 *   npx tsx scripts/phase7/audit-duplicate-clients.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
 */

import { createClient } from "@supabase/supabase-js";

type ClientRow = {
  id: string;
  user_id: string | null;
  advisor_user_id: string | null;
  status: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
};

// table -> column that references clients.id. Each is counted defensively.
const LINKED_TABLES: Array<{ table: string; column: string; label: string }> = [
  { table: "documents", column: "client_id", label: "documents" },
  { table: "client_budgets", column: "client_id", label: "budgets" },
  { table: "adviser_feedback", column: "client_id", label: "feedback" },
  { table: "adviser_appointments", column: "client_id", label: "appointments" },
  { table: "wealth_blueprints", column: "client_id", label: "blueprints" },
  { table: "annual_reviews", column: "client_id", label: "annual_reviews" },
  { table: "discover_profiles", column: "client_id", label: "discover" },
  { table: "advisor_notes", column: "client_id", label: "notes" },
  { table: "advisor_tasks", column: "client_id", label: "tasks" },
];

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const countLinked = async (
    table: string,
    column: string,
    clientId: string,
  ): Promise<number | null> => {
    try {
      const { count, error } = await admin
        .from(table)
        .select(column, { count: "exact", head: true })
        .eq(column, clientId);
      if (error) return null;
      return count ?? 0;
    } catch {
      return null;
    }
  };

  const { data, error } = await admin
    .from("clients")
    .select(
      "id, user_id, advisor_user_id, status, display_name, email, created_at",
    )
    .not("user_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load clients: ${error.message}`);
  }

  const rows = (data ?? []) as ClientRow[];
  const byUser = new Map<string, ClientRow[]>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const duplicates = [...byUser.entries()].filter(([, list]) => list.length > 1);

  console.log("Phase 7 — duplicate clients audit (read-only)\n");
  console.log(`Total user-linked client rows: ${rows.length}`);
  console.log(`Distinct auth users with a client row: ${byUser.size}`);
  console.log(`Auth users with DUPLICATE client rows: ${duplicates.length}\n`);

  if (duplicates.length === 0) {
    console.log(
      "No duplicates found. The unique(user_id) constraint can be applied safely.\n" +
        "Apply: docs/phase7/PENDING_clients_user_id_unique.sql",
    );
    return;
  }

  for (const [userId, list] of duplicates) {
    console.log(`\nuser_id ${userId} — ${list.length} client rows`);
    for (const client of list) {
      const counts: string[] = [];
      for (const { table, column, label } of LINKED_TABLES) {
        const n = await countLinked(table, column, client.id);
        counts.push(`${label}=${n === null ? "n/a" : n}`);
      }
      console.log(
        `  client ${client.id} | created ${client.created_at} | status ${client.status} | ` +
          `advisor ${client.advisor_user_id ?? "none"} | email ${client.email ?? "none"}`,
      );
      console.log(`      linked: ${counts.join(" ")}`);
    }
  }

  console.log(
    "\nNext: follow docs/phase7/DUPLICATE_CLIENT_REMEDIATION.md to choose a " +
      "canonical row per user, merge linked data, then apply the constraint.",
  );
  process.exitCode = 2; // non-zero signals "duplicates present — do not apply constraint yet"
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
