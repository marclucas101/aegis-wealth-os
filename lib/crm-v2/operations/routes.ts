const ALLOWLISTED_OPERATIONS_HREFS = [
  "/advisor-v2/operations",
  "/advisor-v2/operations/google-calendar",
  "/advisor-v2/settings/integrations/google-calendar",
  "/advisor-v2/communications",
  "/advisor-v2/today",
  "/advisor-v2/relationships",
  "/advisor-v2/reports",
] as const;

export function isAllowlistedOperationsHref(href: string | null): boolean {
  if (!href) return true;
  if (ALLOWLISTED_OPERATIONS_HREFS.includes(href as (typeof ALLOWLISTED_OPERATIONS_HREFS)[number])) {
    return true;
  }
  return ALLOWLISTED_OPERATIONS_HREFS.some(
    (prefix) => href.startsWith(`${prefix}/`) && !href.includes(".."),
  );
}

export function buildOperationsHref(): string {
  return "/advisor-v2/operations";
}
