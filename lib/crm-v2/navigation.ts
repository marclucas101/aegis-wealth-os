/** Primary CRM V2 adviser home — pilot default entry. */
export const CRM_V2_HOME_PATH = "/advisor";

/** Classic adviser command centre — safe fallback; avoids redirect loop for pilot advisers. */
export const CRM_V2_CLASSIC_ADVISER_PATH = "/advisor/classic";

/** Legacy pilot alias; sub-routes remain under /advisor-v2 until a future route migration. */
export const CRM_V2_PILOT_ALIAS_HOME_PATH = "/advisor-v2";

export type CrmV2NavItem = {
  label: string;
  href: string;
  description?: string;
};

export type CrmV2MoreNavItem = CrmV2NavItem;

export const CRM_V2_PRIMARY_NAV: CrmV2NavItem[] = [
  { label: "Today", href: "/advisor-v2/today", description: "Daily operating dashboard" },
  {
    label: "Relationships",
    href: "/advisor-v2/relationships",
    description: "Relationship workspace",
  },
  {
    label: "Appointments",
    href: "/advisor-v2/appointments",
    description: "Appointment workflow",
  },
  {
    label: "Service",
    href: "/advisor-v2/service",
    description: "Servicing and commitments",
  },
  {
    label: "Communications",
    href: "/advisor-v2/communications",
    description: "CRM communications bridge",
  },
];

export const CRM_V2_MORE_NAV: CrmV2MoreNavItem[] = [
  { label: "Reports", href: "/advisor-v2/reports" },
  { label: "Operations", href: "/advisor-v2/operations" },
  { label: "Templates", href: "/advisor-v2/templates" },
  { label: "Settings", href: "/advisor-v2/settings" },
];

/**
 * Preserved legacy adviser tools reachable from CRM V2 navigation.
 * Routes verified in Phase 14 audit — do not invent URLs.
 */
export const CRM_V2_LEGACY_TOOLS_NAV: CrmV2NavItem[] = [
  {
    label: "Protection Report Generator",
    href: "/advisor/protection-report",
    description: "Household insurance and ILP coverage summary",
  },
  {
    label: "Shield Diagnostic",
    href: "/advisor/clients",
    description: "Open from a client file, Shield Diagnostic tab",
  },
  {
    label: "Stress Test",
    href: "/advisor/clients",
    description: "Open from a client file, Stress Test tab",
  },
  {
    label: "Planning & Roadmap",
    href: "/advisor/clients",
    description: "Open a client file for roadmap actions",
  },
  {
    label: "Planning Outputs",
    href: "/advisor/clients",
    description: "Open a client file, then Planning outputs from Meeting Packs",
  },
  {
    label: "Client Binder",
    href: "/advisor/clients",
    description: "Open from a client file, Meeting Packs tab",
  },
  {
    label: "Document Vault",
    href: "/advisor/clients",
    description: "Open from a client file, Document Vault tab",
  },
  {
    label: "Meeting Studio",
    href: "/advisor/clients",
    description: "Open a client file to launch Meeting Studio",
  },
  {
    label: "Wealth Blueprint Print",
    href: "/advisor/clients",
    description: "Open from a client file, then reports or meeting packs",
  },
  {
    label: "Annual Review Print",
    href: "/advisor/clients",
    description: "Open from a client file, then reports or meeting packs",
  },
  {
    label: "Insights Authoring",
    href: "/advisor/insights",
    description: "Governed educational content and adviser messages",
  },
  {
    label: "Client Feedback",
    href: "/advisor/feedback",
    description: "Review experience ratings and testimonial-ready submissions",
  },
  {
    label: "Legacy Appointments",
    href: "/advisor/appointments",
    description: "Classic appointment manager",
  },
  {
    label: "Review Pipeline",
    href: "/advisor/classic#advisor-review-pipeline",
    description: "Available in classic workspace",
  },
  {
    label: "Client Onboarding",
    href: "/advisor/classic#advisor-onboarding",
    description: "Add prospective clients in classic workspace",
  },
  {
    label: "Book Health & File Quality",
    href: "/advisor/classic",
    description: "Book-wide health and file quality on classic dashboard",
  },
  {
    label: "Tasks & Follow-ups",
    href: "/advisor/classic#advisor-tasks",
    description: "Classic task board and suggested follow-ups",
  },
  {
    label: "Adviser Profile",
    href: "/advisor/my-profile",
    description: "Profile, photo, and booking setup",
  },
  {
    label: "Google Calendar Setup",
    href: "/advisor/my-profile?section=calendar",
    description: "Connect and manage Google Calendar",
  },
  {
    label: "Google Calendar Operations",
    href: "/advisor-v2/operations/google-calendar",
    description: "Manual sync telemetry and operations",
  },
  {
    label: "Classic Adviser Workspace",
    href: CRM_V2_CLASSIC_ADVISER_PATH,
    description: "Full legacy command centre",
  },
];

export const CRM_V2_DOMAIN_PILLARS = [
  { label: "Relationship", description: "Who you serve" },
  { label: "Engagement", description: "How you connect" },
  { label: "Advice", description: "What you plan" },
  { label: "Service", description: "What you deliver" },
] as const;

function isCrmV2HomePath(pathname: string): boolean {
  return (
    pathname === CRM_V2_HOME_PATH ||
    pathname === CRM_V2_PILOT_ALIAS_HOME_PATH
  );
}

export function isCrmV2NavActive(pathname: string, href: string): boolean {
  if (href === CRM_V2_HOME_PATH || href === CRM_V2_PILOT_ALIAS_HOME_PATH) {
    return isCrmV2HomePath(pathname);
  }
  if (href === "/advisor-v2/today") {
    return pathname === "/advisor-v2/today";
  }
  const hrefPath = (href.split("?")[0] ?? href).split("#")[0] ?? href;
  if (hrefPath.startsWith("/advisor/") && !hrefPath.startsWith("/advisor-v2")) {
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  }
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}
