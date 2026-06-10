/**
 * Lightweight unauthenticated API smoke tests — no credentials required.
 * Run with dev server up: npx tsx scripts/smoke-test-api.ts
 *
 * BASE_URL defaults to http://localhost:3000
 */

type SmokeCase = {
  name: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: string;
  contentType?: string;
  expectStatus: number | readonly number[];
  forbidStatus?: readonly number[];
};

type SmokeResult = {
  name: string;
  pass: boolean;
  detail: string;
};

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const PLACEHOLDER_CLIENT_ID = "00000000-0000-0000-0000-000000000001";
const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000002";
const PLACEHOLDER_TASK_ID = "00000000-0000-0000-0000-000000000003";
const PLACEHOLDER_DOCUMENT_ID = "00000000-0000-0000-0000-000000000004";

const CASES: SmokeCase[] = [
  {
    name: "Health probe responds without server error",
    method: "GET",
    path: "/api/health/supabase",
    expectStatus: [200, 503],
    forbidStatus: [500],
  },
  {
    name: "Health probe JSON has ok field",
    method: "GET",
    path: "/api/health/supabase",
    expectStatus: [200, 503],
  },
  {
    name: "/api/me returns unauthenticated state (200)",
    method: "GET",
    path: "/api/me",
    expectStatus: 200,
    forbidStatus: [500],
  },
  {
    name: "Client read route rejects unauthenticated access",
    method: "GET",
    path: "/api/dashboard/current",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Client write route rejects unauthenticated access",
    method: "POST",
    path: "/api/discover/save",
    body: "{}",
    contentType: "application/json",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Document list rejects unauthenticated access",
    method: "GET",
    path: "/api/documents/list",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Advisor overview rejects unauthenticated access",
    method: "GET",
    path: "/api/advisor/overview",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Advisor command-center heavy rejects unauthenticated access",
    method: "GET",
    path: "/api/advisor/command-center/heavy",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Advisor client workspace rejects unauthenticated access",
    method: "GET",
    path: `/api/advisor/clients/${PLACEHOLDER_CLIENT_ID}`,
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Admin users rejects unauthenticated access",
    method: "GET",
    path: "/api/admin/users",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Admin role update rejects unauthenticated access",
    method: "PATCH",
    path: `/api/admin/users/${PLACEHOLDER_USER_ID}/role`,
    body: JSON.stringify({ role: "client" }),
    contentType: "application/json",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Advisor task mutation rejects unauthenticated access",
    method: "PATCH",
    path: `/api/advisor/tasks/${PLACEHOLDER_TASK_ID}`,
    body: JSON.stringify({ status: "done" }),
    contentType: "application/json",
    expectStatus: 401,
    forbidStatus: [500],
  },
  {
    name: "Advisor document signed-url rejects unauthenticated access",
    method: "POST",
    path: `/api/advisor/clients/${PLACEHOLDER_CLIENT_ID}/documents/${PLACEHOLDER_DOCUMENT_ID}/signed-url`,
    body: "{}",
    contentType: "application/json",
    expectStatus: 401,
    forbidStatus: [500],
  },
];

function statusMatches(
  status: number,
  expected: number | readonly number[],
): boolean {
  if (Array.isArray(expected)) {
    return expected.includes(status);
  }
  return status === expected;
}

async function runCase(testCase: SmokeCase): Promise<SmokeResult> {
  const url = `${BASE_URL}${testCase.path}`;

  try {
    const response = await fetch(url, {
      method: testCase.method,
      headers: testCase.contentType
        ? { "Content-Type": testCase.contentType }
        : undefined,
      body: testCase.body,
      redirect: "manual",
    });

    if (
      testCase.forbidStatus &&
      testCase.forbidStatus.includes(response.status)
    ) {
      return {
        name: testCase.name,
        pass: false,
        detail: `got forbidden status ${response.status}`,
      };
    }

    if (!statusMatches(response.status, testCase.expectStatus)) {
      return {
        name: testCase.name,
        pass: false,
        detail: `expected ${JSON.stringify(testCase.expectStatus)}, got ${response.status}`,
      };
    }

    if (testCase.path === "/api/me") {
      const payload = (await response.json()) as { authenticated?: boolean };
      if (payload.authenticated !== false) {
        return {
          name: testCase.name,
          pass: false,
          detail: "expected authenticated:false in /api/me response",
        };
      }
    }

    if (testCase.name === "Health probe JSON has ok field") {
      const payload = (await response.json()) as { ok?: boolean };
      if (typeof payload.ok !== "boolean") {
        return {
          name: testCase.name,
          pass: false,
          detail: "health response missing boolean ok field",
        };
      }

      const bodyText = JSON.stringify(payload);
      if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(bodyText)) {
        return {
          name: testCase.name,
          pass: false,
          detail: "health response appears to leak a JWT-like token",
        };
      }
    }

    return {
      name: testCase.name,
      pass: true,
      detail: `status ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: testCase.name,
      pass: false,
      detail: `request failed: ${message}`,
    };
  }
}

async function main(): Promise<void> {
  console.log(`API smoke tests against ${BASE_URL}\n`);

  const results: SmokeResult[] = [];

  for (const testCase of CASES) {
    const result = await runCase(testCase);
    results.push(result);
    console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name} — ${result.detail}`);
  }

  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${results.length} total`);

  if (failed > 0) {
    console.log(
      "\nTip: ensure the dev server is running (`npm run dev`) and env vars are set (`npm run qa:env`).",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
