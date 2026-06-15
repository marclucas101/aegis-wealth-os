/**
 * Phase 6C My Adviser access control checks (static analysis).
 * Run: npm run qa:my-adviser
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`My Adviser validation failed: ${message}`);
  }
}

function main(): void {
  let passed = 0;

  assert(
    existsSync(join(ROOT, "supabase/migrations/202606100019_adviser_profiles.sql")),
    "adviser_profiles migration missing",
  );
  passed += 1;

  const migration = read(
    join(ROOT, "supabase/migrations/202606100019_adviser_profiles.sql"),
  );
  assert(migration.includes("adviser_profiles"), "migration creates adviser_profiles");
  assert(migration.includes("adviser-photos"), "migration creates adviser-photos bucket");
  assert(migration.includes("is_advisor()"), "storage policies require is_advisor");
  passed += 1;

  const myAdviserApi = read(join(ROOT, "app/api/my-adviser/route.ts"));
  assert(
    myAdviserApi.includes("loadMyAdviserPageData"),
    "my-adviser API uses server-derived assignment",
  );
  assert(
    !myAdviserApi.includes("adviserUserId") &&
      !myAdviserApi.includes("advisor_user_id"),
    "my-adviser API must not accept client-supplied adviser ID",
  );
  passed += 1;

  const persistence = read(
    join(ROOT, "lib/supabase/adviserProfilePersistence.ts"),
  );
  assert(
    persistence.includes("session.client.advisor_user_id"),
    "assignment derived from authenticated client record",
  );
  assert(
    persistence.includes("approved_testimonial"),
    "testimonials filtered to approved status",
  );
  assert(
    persistence.includes("permission_to_use_as_testimonial"),
    "testimonials require explicit permission",
  );
  assert(
    persistence.includes("testimonial_anonymous"),
    "anonymous consent field respected",
  );
  assert(
    !persistence.includes("what_could_improve") &&
      !persistence.includes("admin_notes"),
    "private feedback fields excluded from public mapping",
  );
  passed += 1;

  const advisorProfileApi = read(join(ROOT, "app/api/advisor/profile/route.ts"));
  assert(
    advisorProfileApi.includes("requireAdvisorAccess"),
    "adviser profile API gated",
  );
  passed += 1;

  const photoApi = read(join(ROOT, "app/api/advisor/profile/photo/route.ts"));
  assert(photoApi.includes("requireAdvisorAccess"), "photo upload gated");
  assert(
    photoApi.includes("access.authUser.id"),
    "photo upload scoped to authenticated adviser",
  );
  passed += 1;

  const navigation = read(join(ROOT, "lib/navigation.ts"));
  assert(
    navigation.includes('href: "/my-adviser"') &&
      navigation.includes('label: "My Adviser"') &&
      navigation.includes("clientOnly: true"),
    "client navigation includes My Adviser (clients only)",
  );
  assert(
    navigation.includes('href: "/advisor/my-profile"') &&
      navigation.includes("advisorOnly: true"),
    "My Profile hidden from clients",
  );
  passed += 1;

  const middleware = read(join(ROOT, "middleware.ts"));
  assert(middleware.includes('"/my-adviser"'), "my-adviser route protected");
  passed += 1;

  const testimonialMapper = read(
    join(ROOT, "src/lib/myAdviser/testimonialMapping.ts"),
  );
  assert(
    testimonialMapper.includes("Verified client"),
    "anonymous testimonial label present",
  );
  passed += 1;

  console.log(`My Adviser validations passed (${passed} assertion groups).`);
}

main();
