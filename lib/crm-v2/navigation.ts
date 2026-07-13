/** Primary AEGIS adviser workspace home. */
export const CRM_V2_HOME_PATH = "/advisor";

/** Classic adviser command centre — emergency fallback; avoids redirect loop for eligible advisers. */
export const CRM_V2_CLASSIC_ADVISER_PATH = "/advisor/classic";

/** Legacy route alias — `/advisor-v2` home redirects here; sub-routes remain under `/advisor-v2/*`. */
export const CRM_V2_PILOT_ALIAS_HOME_PATH = "/advisor-v2";

export type CrmV2NavItem = {
  label: string;
  href: string;
  description?: string;
};

export type CrmV2MoreNavItem = CrmV2NavItem;

export type CrmV2NavGroup = {
  label: string;
  items: CrmV2NavItem[];
};

export const CRM_V2_PRIMARY_NAV: CrmV2NavItem[] = [
  { label: "Today", href: "/advisor-v2/today", description: "Daily operating dashboard" },
  {
    label: "Relationships",
    href: "/advisor-v2/relationships",
    description: "Client roster and relationship workspace",
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
    label: "Reports",
    href: "/advisor-v2/reports",
    description: "Adviser reports and summaries",
  },
  {
    label: "Operations",
    href: "/advisor-v2/operations",
    description: "Diagnostics and operator tools",
  },
];

export const CRM_V2_MORE_NAV: CrmV2MoreNavItem[] = [
  {
    label: "Communications",
    href: "/advisor-v2/communications",
    description: "Governed communications bridge",
  },
  { label: "Templates", href: "/advisor-v2/templates", description: "Document templates" },
  { label: "Settings", href: "/advisor-v2/settings", description: "Workspace settings" },
];

/**
 * Preserved legacy adviser tools grouped under More → Tools.
 * Routes verified in Phase 14 audit — do not invent URLs.
 */
export const CRM_V2_TOOLS_NAV_GROUPS: CrmV2NavGroup[] = [
  {
    label: "Protection & planning",
    items: [
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
    ],
  },
  {
    label: "Documents & meetings",
    items: [
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
    ],
  },
  {
    label: "Service & workflows",
    items: [
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
    ],
  },
  {
    label: "Setup & fallback",
    items: [
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
        description: "Emergency fallback command centre",
      },
    ],
  },
];

/** Flat list of all tool links — used for active-state resolution and parity inventory. */
export const CRM_V2_LEGACY_TOOLS_NAV: CrmV2NavItem[] = CRM_V2_TOOLS_NAV_GROUPS.flatMap(
  (group) => group.items,
);

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
