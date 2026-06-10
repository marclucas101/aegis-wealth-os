/**
 * Temporary production navigation probe (user-approved diagnostic flow).
 *
 * Reproduces the reported bug: login stores the sb-* cookie, then it
 * disappears while navigating between protected pages. Walks the same
 * navigation sequence with a throwaway user and reports, for every response:
 * status, location, X-Aegis-Session-Cleared, and Set-Cookie NAMES/ATTRIBUTES
 * (values never printed). Decodes only the access token expiry delta.
 *
 * Run: npx tsx scripts/tmp-prod-nav-probe.ts
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://aegis-wealth-os.vercel.app";

function loadEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0 || line.trimStart().startsWith("#")) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

type Jar = Map<string, string>;

function applySetCookies(jar: Jar, setCookies: string[]): string[] {
  const events: string[] = [];
  for (const sc of setCookies) {
    const pair = sc.split(";")[0]!;
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const attrs = sc.slice(pair.length + 1).trim();
    const cleared = !value || /max-age=0/i.test(attrs);
    if (cleared) {
      jar.delete(name);
      events.push(`CLEAR ${name} (${attrs})`);
    } else {
      jar.set(name, value);
      events.push(`SET ${name} <len ${value.length}> (${attrs})`);
    }
  }
  return events;
}

function cookieHeader(jar: Jar): string {
  return Array.from(jar.entries())
    .map(([n, v]) => `${n}=${v}`)
    .join("; ");
}

function jarNames(jar: Jar): string {
  return Array.from(jar.keys()).join(", ") || "(empty)";
}

async function step(jar: Jar, method: string, path: string, body?: URLSearchParams) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(jar.size > 0 ? { Cookie: cookieHeader(jar) } : {}),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    redirect: "manual",
  });
  const events = applySetCookies(jar, res.headers.getSetCookie());
  console.log(`\n${method} ${path}`);
  console.log(`  status=${res.status} location=${res.headers.get("location") ?? "-"}`);
  const cleared = res.headers.get("x-aegis-session-cleared");
  if (cleared) console.log(`  X-Aegis-Session-Cleared: ${cleared}`);
  const stage = res.headers.get("x-aegis-auth-stage");
  if (stage) console.log(`  X-Aegis-Auth-Stage: ${stage}`);
  for (const e of events) console.log(`  ${e}`);
  console.log(`  jar now: ${jarNames(jar)}`);
  return res;
}

function accessTokenExpiryDeltaSeconds(jar: Jar): number | null {
  // Cookie value format: base64-<base64url(JSON session)>; never printed.
  for (const [name, value] of jar.entries()) {
    if (!/^sb-.*-auth-token$/.test(name)) continue;
    try {
      const raw = value.startsWith("base64-")
        ? Buffer.from(value.slice(7), "base64url").toString("utf8")
        : decodeURIComponent(value);
      const session = JSON.parse(raw) as { expires_at?: number };
      if (session.expires_at) {
        return session.expires_at - Math.floor(Date.now() / 1000);
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const env = loadEnvLocal();
  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const email = `aegis.probe.${Date.now()}@example.com`;
  const password = `Probe-${randomBytes(12).toString("base64url")}`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) {
    throw new Error(`createUser failed: ${createError?.message}`);
  }
  console.log("created probe user:", email);

  const jar: Jar = new Map();

  try {
    await step(jar, "POST", "/auth/login", new URLSearchParams({ email, password }));

    const expDelta = accessTokenExpiryDeltaSeconds(jar);
    console.log(`\naccess token expires in: ${expDelta ?? "unknown"} seconds`);

    // Same navigation pattern as the user: dashboard -> discover -> protected pages
    for (const path of [
      "/dashboard",
      "/discover",
      "/shield-diagnostic",
      "/annual-review",
      "/api/me?t=1",
    ]) {
      await step(jar, "GET", path);
    }

    // Parallel burst (simulates RSC + client data fetches on page load)
    console.log("\n--- parallel burst of 5 requests ---");
    const header = cookieHeader(jar);
    const burst = await Promise.all(
      ["/api/me?t=2", "/api/profile/current", "/api/roadmap/current", "/dashboard", "/profile"].map(
        async (path) => {
          const res = await fetch(`${BASE}${path}`, {
            headers: { Cookie: header },
            redirect: "manual",
          });
          return { path, status: res.status, setCookies: res.headers.getSetCookie() };
        },
      ),
    );
    for (const r of burst) {
      const events = applySetCookies(jar, r.setCookies);
      console.log(`${r.path}: status=${r.status}${events.length ? "\n  " + events.join("\n  ") : ""}`);
    }
    console.log(`jar now: ${jarNames(jar)}`);

    await step(jar, "GET", "/api/me?t=3");
  } finally {
    const userId = created.user.id;
    await admin.from("clients").delete().eq("user_id", userId);
    await admin.from("users").delete().eq("id", userId);
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    console.log("\nprobe user deleted:", delErr ? `FAILED: ${delErr.message}` : "ok");
  }
}

main().catch((err) => {
  console.error("probe failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
