/**
 * Prints demo login accounts (no secrets).
 * Run: npx tsx scripts/demo-login-guide.ts
 */

import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PERSONAS,
  DEMO_PASSWORD,
} from "./seed-demo-data";

function main(): void {
  console.log("Aegis Wealth OS — Demo Login Guide\n");
  console.log(`Email domain: @${DEMO_EMAIL_DOMAIN}`);
  console.log(`Shared password: ${DEMO_PASSWORD}`);
  console.log("(Fictional accounts for demos and QA only.)\n");

  console.log("Accounts:\n");

  for (const persona of DEMO_PERSONAS) {
    const roleLabel = persona.role.toUpperCase();
    console.log(`  [${roleLabel}] ${persona.fullName}`);
    console.log(`          ${persona.email}`);
    console.log(`          ${persona.profileSummary}`);
    if (persona.clientStatus) {
      console.log(`          Status: ${persona.clientStatus}`);
    }
    console.log("");
  }

  console.log("Suggested entry points:");
  console.log("  Client portal  → log in as a client persona");
  console.log("  Advisor OS     → /advisor as advisor@…");
  console.log("  Admin          → /admin as admin@…");
  console.log("\nSee docs/DEMO_SCRIPT.md for a 10–15 minute walkthrough.");
}

main();
