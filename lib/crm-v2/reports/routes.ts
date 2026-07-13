const ALLOWLISTED_REPORT_HREFS = [
  "/advisor-v2/relationships",
  "/advisor-v2/appointments",
  "/advisor-v2/service",
  "/advisor-v2/communications",
  "/advisor-v2/operations",
  "/advisor-v2/today",
  "/advisor-v2/settings/integrations/google-calendar",
] as const;

export function isAllowlistedReportHref(href: string): boolean {
  if (ALLOWLISTED_REPORT_HREFS.includes(href as (typeof ALLOWLISTED_REPORT_HREFS)[number])) {
    return true;
  }
  return ALLOWLISTED_REPORT_HREFS.some(
    (prefix) => href.startsWith(`${prefix}/`) && !href.includes(".."),
  );
}

export function buildReportsHref(): string {
  return "/advisor-v2/reports";
}
