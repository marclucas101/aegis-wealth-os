/**
 * Phase 6A adviser access control regression checks (static analysis).
 * Run: npm run security:advisor-access
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const APP_ROOT = join(ROOT, "app");
const API_ROOT = join(ROOT, "app", "api");

type Finding = {
  id: string;
  pass: boolean;
  detail: string;
};

function walkFiles(dir: string, fileName: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkFiles(fullPath, fileName, acc);
      continue;
    }

    if (entry === fileName) {
      acc.push(fullPath);
    }
  }

  return acc.sort();
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, "/");
}

function checkLayoutGuard(
  layoutPath: string,
  guardName: string,
  label: string,
): Finding {
  if (!existsSync(layoutPath)) {
    return {
      id: label,
      pass: false,
      detail: `Missing ${rel(layoutPath)}`,
    };
  }

  const source = read(layoutPath);
  const hasGuard = source.includes(guardName);
  const hasAccessDenied =
    source.includes("AccessDenied") || source.includes("access denied");

  return {
    id: label,
    pass: hasGuard && hasAccessDenied,
    detail: hasGuard
      ? `${rel(layoutPath)} calls ${guardName}`
      : `${rel(layoutPath)} missing ${guardName}`,
  };
}

function checkAdvisorPagesUseLayout(): Finding {
  const pages = walkFiles(join(APP_ROOT, "advisor"), "page.tsx");
  const layoutPath = join(APP_ROOT, "advisor", "layout.tsx");

  if (!existsSync(layoutPath)) {
    return {
      id: "advisor-pages-layout",
      pass: false,
      detail: "app/advisor/layout.tsx not found",
    };
  }

  const layoutSource = read(layoutPath);
  const layoutGuards =
    layoutSource.includes("requireAdvisorAccess") &&
    layoutSource.includes("AdvisorAccessDenied");

  const perPageGuards = pages.filter((page) => {
    const source = read(page);
    return (
      source.includes("requireAdvisorAccess") &&
      !source.includes("AdvisorAccessDenied")
    );
  });

  return {
    id: "advisor-pages-layout",
    pass: layoutGuards && perPageGuards.length === 0,
    detail: layoutGuards
      ? `Central layout guards ${pages.length} advisor page(s)`
      : "Advisor layout missing requireAdvisorAccess gate",
  };
}

function checkAdminPagesUseLayout(): Finding {
  const layoutPath = join(APP_ROOT, "admin", "layout.tsx");

  if (!existsSync(layoutPath)) {
    return {
      id: "admin-pages-layout",
      pass: false,
      detail: "app/admin/layout.tsx not found",
    };
  }

  const layoutSource = read(layoutPath);
  const pagePath = join(APP_ROOT, "admin", "page.tsx");
  const pageSource = existsSync(pagePath) ? read(pagePath) : "";

  const layoutGuards =
    layoutSource.includes("requireAdminAccess") &&
    layoutSource.includes("AdminAccessDenied");
  const pageDoesNotDuplicate =
    !pageSource.includes("requireAdminAccess") &&
    !pageSource.includes("AdminAccessDenied");

  return {
    id: "admin-pages-layout",
    pass: layoutGuards && pageDoesNotDuplicate,
    detail: layoutGuards
      ? "Central admin layout enforces requireAdminAccess"
      : "Admin layout missing requireAdminAccess gate",
  };
}

function checkApiGuards(prefix: string, guardName: string): Finding {
  const apiDir = join(API_ROOT, prefix);
  const routes = walkFiles(apiDir, "route.ts");
  const missing = routes.filter((file) => !read(file).includes(guardName));

  return {
    id: `api-${prefix}-guards`,
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? `All ${routes.length} /api/${prefix} route(s) use ${guardName}`
        : `Missing ${guardName}: ${missing.map(rel).join(", ")}`,
  };
}

function checkNavigationRoleFiltering(): Finding {
  const navPath = join(ROOT, "lib", "navigation.ts");
  const sidebarPath = join(ROOT, "components", "aegis", "SidebarNav.tsx");
  const shellPath = join(ROOT, "components", "aegis", "AuthenticatedAppShell.tsx");

  const navSource = read(navPath);
  const sidebarSource = read(sidebarPath);
  const shellSource = read(shellPath);

  const advisoryItemsMarked = [
    'href: "/advisor"',
    'href: "/advisor/promotions"',
    'href: "/advisor/feedback"',
    'href: "/advisor/protection-report"',
  ].every(
    (snippet) =>
      navSource.includes(snippet) && navSource.includes("advisorOnly: true"),
  );

  const adminMarked =
    navSource.includes('href: "/admin"') &&
    navSource.includes("adminOnly: true");

  const hasRoleFilter = navSource.includes("getNavSectionsForRole");
  const sidebarNoProbe = !sidebarSource.includes("/api/admin/users");
  const serverShell = shellSource.includes("getNavSectionsForRole");

  return {
    id: "navigation-role-filter",
    pass:
      advisoryItemsMarked &&
      adminMarked &&
      hasRoleFilter &&
      sidebarNoProbe &&
      serverShell,
    detail:
      advisoryItemsMarked && adminMarked && hasRoleFilter && sidebarNoProbe
        ? "Advisory nav items are role-gated server-side"
        : "Navigation role filtering incomplete",
  };
}

function checkAuthHelpers(): Finding {
  const authGuardsPath = join(ROOT, "lib", "supabase", "authGuards.ts");
  const advisorAuthPath = join(ROOT, "lib", "supabase", "advisorAuth.ts");
  const adminPath = join(ROOT, "lib", "supabase", "adminManagement.ts");

  const authSource = read(authGuardsPath);
  const advisorSource = read(advisorAuthPath);
  const adminSource = read(adminPath);

  const hasHelpers =
    authSource.includes("requireAuthenticatedUser") &&
    authSource.includes("getCurrentUserRole") &&
    advisorSource.includes("requireAdvisorAccess") &&
    adminSource.includes("requireAdminAccess") &&
    advisorSource.includes("requireAuthenticatedUser") &&
    adminSource.includes("requireAuthenticatedUser");

  return {
    id: "central-auth-helpers",
    pass: hasHelpers,
    detail: hasHelpers
      ? "Central auth helpers consolidated in lib/supabase/authGuards.ts"
      : "Missing central auth helper wiring",
  };
}

function checkNoSignOutOnAccessDenied(): Finding {
  const paths = [
    join(ROOT, "app", "advisor", "layout.tsx"),
    join(ROOT, "app", "admin", "layout.tsx"),
    join(ROOT, "components", "aegis", "advisor", "AdvisorAccessDenied.tsx"),
    join(ROOT, "components", "aegis", "admin", "AdminAccessDenied.tsx"),
    join(ROOT, "lib", "supabase", "advisorAuth.ts"),
    join(ROOT, "lib", "supabase", "adminManagement.ts"),
    join(ROOT, "lib", "supabase", "authGuards.ts"),
  ];

  const offenders = paths.filter(
    (path) => existsSync(path) && read(path).includes("signOut"),
  );

  return {
    id: "no-signout-on-denial",
    pass: offenders.length === 0,
    detail:
      offenders.length === 0
        ? "Access denial paths do not call signOut()"
        : `signOut found in: ${offenders.map(rel).join(", ")}`,
  };
}

function checkAccessDeniedCopy(): Finding {
  const deniedPath = join(
    ROOT,
    "components",
    "aegis",
    "advisor",
    "AdvisorAccessDenied.tsx",
  );
  const source = read(deniedPath);

  const hasHeading = source.includes("Adviser access required");
  const hasBody = source.includes(
    "This workspace is restricted to authorised advisory personnel",
  );
  const noInternals =
    !source.includes("public.users.role") && !source.includes("Supabase");

  return {
    id: "access-denied-ui",
    pass: hasHeading && hasBody && noInternals,
    detail:
      hasHeading && hasBody
        ? "AdvisorAccessDenied uses refined copy without internals"
        : "AdvisorAccessDenied copy needs update",
  };
}

function checkClientNavExcludesAdvisory(): Finding {
  const navPath = join(ROOT, "lib", "navigation.ts");
  const source = read(navPath);

  const clientSections =
    source.includes("getNavSectionsForRole") &&
    source.includes("isNavItemVisibleForRole");

  return {
    id: "client-nav-no-advisory",
    pass: clientSections,
    detail:
      clientSections
        ? "Client role receives no Advisory section via getNavSectionsForRole"
        : "Client navigation may still expose Advisory items",
  };
}

function main(): void {
  const findings: Finding[] = [
    checkLayoutGuard(
      join(APP_ROOT, "advisor", "layout.tsx"),
      "requireAdvisorAccess",
      "layout-advisor-guard",
    ),
    checkLayoutGuard(
      join(APP_ROOT, "admin", "layout.tsx"),
      "requireAdminAccess",
      "layout-admin-guard",
    ),
    checkAdvisorPagesUseLayout(),
    checkAdminPagesUseLayout(),
    checkApiGuards("advisor", "requireAdvisorAccess"),
    checkApiGuards("admin", "requireAdminAccess"),
    checkNavigationRoleFiltering(),
    checkAuthHelpers(),
    checkNoSignOutOnAccessDenied(),
    checkAccessDeniedCopy(),
    checkClientNavExcludesAdvisory(),
  ];

  console.log("Phase 6A adviser access control checks\n");

  let failed = 0;
  for (const finding of findings) {
    const status = finding.pass ? "PASS" : "FAIL";
    if (!finding.pass) failed += 1;
    console.log(`  ${status}  ${finding.id}`);
    console.log(`         ${finding.detail}`);
  }

  console.log(`\n${findings.length - failed}/${findings.length} checks passed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
