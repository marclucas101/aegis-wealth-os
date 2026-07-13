import {
  CRM_V2_COMMUNICATIONS_PATH,
  CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
  CRM_V2_OPERATIONS_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_REPORTS_PATH,
  CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
  CRM_V2_TODAY_PATH,
} from "@/lib/crm-v2/navigation";

const ALLOWLISTED_OPERATIONS_HREFS = [
  CRM_V2_OPERATIONS_PATH,
  CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
  CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
  CRM_V2_COMMUNICATIONS_PATH,
  CRM_V2_TODAY_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_REPORTS_PATH,
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
  return CRM_V2_OPERATIONS_PATH;
}
