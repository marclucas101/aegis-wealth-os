/**
 * Phase 7 — client provisioning hardening regression checks.
 *
 * Two layers:
 *  A. Behavioural simulation of the DB guarantee (unique index on
 *     clients(user_id) + INSERT ... ON CONFLICT (user_id) DO NOTHING) and the
 *     provisionClientRow() control flow (upsert → refetch by user_id).
 *  B. Static source audit confirming the real code matches the intended shape
 *     and that there is exactly ONE user-linked provisioning insert path.
 *
 * No database access; pure logic + source inspection. Exit code 1 on failure.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

let groups = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  FAIL  ${message}`);
    process.exit(1);
  }
}
function group(name: string, fn: () => void): void {
  fn();
  groups += 1;
  console.log(`  PASS  ${name}`);
}

// ---------------------------------------------------------------------------
// A. Behavioural model: faithful in-memory clients table.
// ---------------------------------------------------------------------------
type Row = {
  id: string;
  user_id: string | null;
  advisor_user_id: string | null;
  status: string;
  display_name: string;
  created_at: number;
};

class FakeClients {
  rows: Row[] = [];
  private seq = 0;

  /** INSERT ... ON CONFLICT (user_id) DO NOTHING (ignoreDuplicates: true). */
  upsertIgnore(payload: Omit<Row, "id" | "created_at">): { conflict: boolean } {
    if (
      payload.user_id !== null &&
      this.rows.some((r) => r.user_id === payload.user_id)
    ) {
      // Unique index on non-NULL user_id → conflict ignored, existing row kept.
      return { conflict: true };
    }
    this.seq += 1;
    this.rows.push({ id: `c${this.seq}`, created_at: this.seq, ...payload });
    return { conflict: false };
  }

  fetchByUserId(userId: string): Row | null {
    const matches = this.rows
      .filter((r) => r.user_id === userId)
      .sort((a, b) => a.created_at - b.created_at);
    return matches[0] ?? null;
  }

  countByUserId(userId: string): number {
    return this.rows.filter((r) => r.user_id === userId).length;
  }

  updateAdvisor(id: string, advisor: string | null): void {
    const r = this.rows.find((x) => x.id === id);
    if (r) r.advisor_user_id = advisor;
  }
}

const newPayload = (userId: string): Omit<Row, "id" | "created_at"> => ({
  user_id: userId,
  advisor_user_id: null,
  status: "onboarding",
  display_name: "Client",
});

/** Mirrors provisionClientRow(): try fetch, else upsert-ignore, then refetch. */
function provision(table: FakeClients, userId: string): Row {
  let row = table.fetchByUserId(userId);
  if (!row) {
    table.upsertIgnore(newPayload(userId));
    row = table.fetchByUserId(userId);
  }
  if (!row) throw new Error("row missing after upsert");
  return row;
}

const USER = "11111111-1111-1111-1111-111111111111";

group("first login creates exactly one row", () => {
  const t = new FakeClients();
  const row = provision(t, USER);
  assert(t.countByUserId(USER) === 1, "expected one row after first login");
  assert(row.user_id === USER, "row belongs to the user");
});

group("repeated provisioning returns the same row", () => {
  const t = new FakeClients();
  const a = provision(t, USER);
  const b = provision(t, USER);
  const c = provision(t, USER);
  assert(a.id === b.id && b.id === c.id, "same row id across calls");
  assert(t.countByUserId(USER) === 1, "still exactly one row");
});

group("concurrent provisioning cannot create duplicates", () => {
  const t = new FakeClients();
  // Two requests both observe "no row" before either writes (worst-case race).
  const seen1 = t.fetchByUserId(USER);
  const seen2 = t.fetchByUserId(USER);
  assert(seen1 === null && seen2 === null, "both racers see no row initially");
  const w1 = t.upsertIgnore(newPayload(USER)); // inserts
  const w2 = t.upsertIgnore(newPayload(USER)); // ON CONFLICT DO NOTHING
  assert(w1.conflict === false, "first writer inserts");
  assert(w2.conflict === true, "second writer is a no-op (no duplicate)");
  const r1 = t.fetchByUserId(USER);
  const r2 = t.fetchByUserId(USER);
  assert(!!r1 && !!r2 && r1.id === r2.id, "both racers resolve same row");
  assert(t.countByUserId(USER) === 1, "exactly one row after the race");
});

group("existing advisor_user_id is never overwritten by provisioning", () => {
  const t = new FakeClients();
  provision(t, USER);
  const row = t.fetchByUserId(USER)!;
  t.updateAdvisor(row.id, "adv-9000"); // adviser assignment
  // Re-provision (e.g. next login): fetch finds the row, no write happens.
  const after = provision(t, USER);
  assert(after.advisor_user_id === "adv-9000", "advisor preserved on re-login");
  // Even a direct racing upsert with advisor_user_id:null must not clobber it.
  const w = t.upsertIgnore(newPayload(USER));
  assert(w.conflict === true, "conflicting upsert ignored");
  assert(
    t.fetchByUserId(USER)!.advisor_user_id === "adv-9000",
    "advisor still preserved after ignored upsert",
  );
  assert(t.countByUserId(USER) === 1, "no duplicate created");
});

group("placeholder clients (user_id IS NULL) are unconstrained", () => {
  const t = new FakeClients();
  t.upsertIgnore({
    user_id: null,
    advisor_user_id: "adv-1",
    status: "onboarding",
    display_name: "Placeholder A",
  });
  t.upsertIgnore({
    user_id: null,
    advisor_user_id: "adv-2",
    status: "onboarding",
    display_name: "Placeholder B",
  });
  const nulls = t.rows.filter((r) => r.user_id === null).length;
  assert(nulls === 2, "multiple NULL user_id placeholders allowed");
});

group("adviser assignment updates the existing row (no new row)", () => {
  const t = new FakeClients();
  provision(t, USER);
  const before = t.fetchByUserId(USER)!;
  t.updateAdvisor(before.id, "adv-5"); // assign
  t.updateAdvisor(before.id, "adv-6"); // reassign
  t.updateAdvisor(before.id, null); // unassign
  assert(t.countByUserId(USER) === 1, "assignment changes never add rows");
  assert(t.fetchByUserId(USER)!.id === before.id, "same row id throughout");
});

group("exactly one client row per non-null user id (mixed workload)", () => {
  const t = new FakeClients();
  const users = [USER, "22222222-2222-2222-2222-222222222222", USER, USER];
  for (const u of users) provision(t, u);
  t.upsertIgnore({
    user_id: null,
    advisor_user_id: null,
    status: "onboarding",
    display_name: "P",
  });
  const counts = new Map<string, number>();
  for (const r of t.rows) {
    if (r.user_id === null) continue;
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }
  for (const [uid, n] of counts) {
    assert(n === 1, `user ${uid} must have exactly one row, found ${n}`);
  }
});

// ---------------------------------------------------------------------------
// B. Static source audit.
// ---------------------------------------------------------------------------
const read = (rel: string): string =>
  readFileSync(join(repoRoot, rel), "utf8");

const userProfileSrc = read("lib/supabase/userProfile.ts");

group("provisioning uses a concurrency-safe upsert (onConflict + ignoreDuplicates)", () => {
  assert(userProfileSrc.includes(".upsert("), "userProfile.ts uses .upsert(");
  assert(
    userProfileSrc.includes('onConflict: "user_id"'),
    'onConflict: "user_id" present',
  );
  assert(
    userProfileSrc.includes("ignoreDuplicates: true"),
    "ignoreDuplicates: true present",
  );
});

group("provisioning refetches the canonical row by user_id", () => {
  assert(
    /provisionClientRow[\s\S]*fetchClientByUserId\(admin, authUser\.id\)/.test(
      userProfileSrc,
    ),
    "provisionClientRow refetches via fetchClientByUserId",
  );
  assert(
    userProfileSrc.includes('.eq("user_id", userId)'),
    "fetchClientByUserId resolves by user_id",
  );
});

group("a duplicate-key (23505) is handled as refetch, not failure", () => {
  assert(
    userProfileSrc.includes('upsertError.code !== "23505"'),
    "23505 is tolerated (falls through to refetch)",
  );
});

group("userProfile.ts no longer INSERTs into clients (single upsert path)", () => {
  const clientsInserts = countSequence(userProfileSrc, "clients", "insert");
  assert(
    clientsInserts === 0,
    `expected 0 clients .insert() in userProfile.ts, found ${clientsInserts}`,
  );
});

group("exactly one user-linked client provisioning path across lib", () => {
  // Self-provisioning (the upsert) lives only in userProfile.ts.
  assert(
    countSequence(userProfileSrc, "clients", "upsert") === 1,
    "exactly one clients upsert in userProfile.ts",
  );
  // The only remaining clients INSERT is the placeholder (user_id may be NULL),
  // and it lives in clientOnboarding.ts.
  const onboardingSrc = read("lib/supabase/clientOnboarding.ts");
  assert(
    countSequence(onboardingSrc, "clients", "insert") === 1,
    "placeholder insert remains in clientOnboarding.ts",
  );
  assert(
    onboardingSrc.includes("user_id: linkedUserId"),
    "placeholder insert is not hardcoded to a self user id (NULL/linked only)",
  );
  // adminManagement assigns advisors via UPDATE only — never inserts clients.
  const adminSrc = read("lib/supabase/adminManagement.ts");
  assert(
    countSequence(adminSrc, "clients", "insert") === 0 &&
      countSequence(adminSrc, "clients", "upsert") === 0,
    "adminManagement.ts never inserts/upserts clients (assignment is UPDATE)",
  );
});

group("final-state migration exists and is additive/idempotent", () => {
  const migration = read(
    "supabase/migrations/202606150001_clients_user_id_unique.sql",
  );
  assert(
    migration.includes("CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique"),
    "uses CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique",
  );
  assert(
    migration.includes("public.clients (user_id)"),
    "applies to public.clients(user_id)",
  );
});

/**
 * Counts occurrences of `.from("<table>")` followed (within a small window) by
 * `.<op>(`, tolerant of whitespace/newlines between the chained calls.
 */
function countSequence(src: string, table: string, op: string): number {
  const re = new RegExp(
    `from\\("${table}"\\)\\s*\\.${op}\\(`,
    "g",
  );
  return (src.match(re) ?? []).length;
}

console.log(
  `\nProvisioning hardening validations passed (${groups} assertion groups).`,
);
