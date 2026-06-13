/**
 * Phase 6E My Clients workspace access checks (static analysis).
 * Run: npm run qa:my-clients
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`My Clients validation failed: ${message}`);
  }
}

function main(): void {
  let passed = 0;

  assert(
    existsSync(join(ROOT, "app/advisor/clients/page.tsx")),
    "My Clients list page missing",
  );
  assert(
    existsSync(join(ROOT, "app/api/advisor/clients/route.ts")),
    "paginated clients list API missing",
  );
  passed += 1;

  const listApi = read(join(ROOT, "app/api/advisor/clients/route.ts"));
  assert(listApi.includes("requireAdvisorAccess"), "list API gated");
  assert(
    listApi.includes("loadAdvisorClientListPage"),
    "list API uses server-side loader",
  );
  assert(listApi.includes("page"), "pagination supported");
  passed += 1;

  const listQueries = read(
    join(ROOT, "lib/supabase/advisorClientListQueries.ts"),
  );
  assert(
    listQueries.includes('eq("advisor_user_id", authUserId)'),
    "adviser list filtered by assignment",
  );
  assert(
    listQueries.includes(".range(from, to)"),
    "server-side pagination range used",
  );
  passed += 1;

  const access = read(join(ROOT, "lib/supabase/advisorClientAccess.ts"));
  assert(
    access.includes("resolveAccessibleClient"),
    "shared client access resolver exists",
  );
  assert(
    access.includes("client.advisor_user_id !== authUserId"),
    "forbidden when adviser not assigned",
  );
  passed += 1;

  const budgetApi = read(
    join(ROOT, "app/api/advisor/clients/[clientId]/budget/route.ts"),
  );
  const appointmentsApi = read(
    join(ROOT, "app/api/advisor/clients/[clientId]/appointments/route.ts"),
  );
  const feedbackApi = read(
    join(ROOT, "app/api/advisor/clients/[clientId]/feedback/route.ts"),
  );

  for (const [label, source] of [
    ["budget API", budgetApi],
    ["appointments API", appointmentsApi],
    ["feedback API", feedbackApi],
  ] as const) {
    assert(source.includes("resolveAccessibleClient"), `${label} checks access`);
    assert(source.includes("forbidden"), `${label} returns forbidden`);
  }
  passed += 1;

  const navigation = read(join(ROOT, "lib/navigation.ts"));
  assert(
    navigation.includes('href: "/advisor/clients"') &&
      navigation.includes('label: "My Clients"') &&
      navigation.includes("advisorOnly: true"),
    "My Clients nav is adviser-only",
  );
  passed += 1;

  const header = read(
    join(ROOT, "components/aegis/advisor/AdvisorClientCommandHeader.tsx"),
  );
  assert(header.includes('href="/advisor/clients"'), "detail back link to My Clients");
  passed += 1;

  const workspace = read(
    join(ROOT, "components/aegis/advisor/AdvisorClientWorkspace.tsx"),
  );
  assert(workspace.includes("activeTab"), "workspace uses tab navigation");
  assert(
    workspace.includes("AdvisorClientBudgetPanel"),
    "budget tab panel wired",
  );
  assert(
    workspace.includes("AdvisorClientAppointmentsPanel"),
    "appointments tab panel wired",
  );
  assert(
    workspace.includes("AdvisorClientFeedbackPanel"),
    "feedback tab panel wired",
  );
  passed += 1;

  console.log(`My Clients validations passed (${passed} assertion groups).`);
}

main();
