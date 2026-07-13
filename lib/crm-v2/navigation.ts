/** Primary AEGIS adviser workspace home. */
export const CRM_V2_HOME_PATH = "/advisor";

/** Classic adviser command centre — emergency fallback; avoids redirect loop for eligible advisers. */
export const CRM_V2_CLASSIC_ADVISER_PATH = "/advisor/classic";

/** Legacy route alias — `/advisor-v2` and sub-routes redirect to canonical `/advisor` paths. */
export const CRM_V2_PILOT_ALIAS_HOME_PATH = "/advisor-v2";

/** Canonical CRM V2 adviser module paths (Phase 16). */
export const CRM_V2_TODAY_PATH = "/advisor/today";
export const CRM_V2_RELATIONSHIPS_PATH = "/advisor/relationships";
/** Legacy `/advisor/appointments` preserved — CRM V2 appointments live under workspace prefix. */
export const CRM_V2_APPOINTMENTS_PATH = "/advisor/workspace/appointments";
export const CRM_V2_SERVICE_PATH = "/advisor/service";
export const CRM_V2_REPORTS_PATH = "/advisor/reports";
export const CRM_V2_OPERATIONS_PATH = "/advisor/operations";
export const CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH =
  "/advisor/operations/google-calendar";
export const CRM_V2_COMMUNICATIONS_PATH = "/advisor/communications";
export const CRM_V2_TEMPLATES_PATH = "/advisor/templates";
export const CRM_V2_SETTINGS_PATH = "/advisor/settings";
export const CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH =
  "/advisor/settings/integrations/google-calendar";

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
  { label: "Today", href: CRM_V2_TODAY_PATH, description: "Daily operating dashboard" },
  {
    label: "Relationships",
    href: CRM_V2_RELATIONSHIPS_PATH,
    description: "Client roster and relationship workspace",
  },
  {
    label: "Appointments",
    href: CRM_V2_APPOINTMENTS_PATH,
    description: "Appointment workflow",
  },
  {
    label: "Service",
    href: CRM_V2_SERVICE_PATH,
    description: "Servicing and commitments",
  },
  {
    label: "Reports",
    href: CRM_V2_REPORTS_PATH,
    description: "Adviser reports and summaries",
  },
  {
    label: "Operations",
    href: CRM_V2_OPERATIONS_PATH,
    description: "Diagnostics and operator tools",
  },
];

export const CRM_V2_MORE_NAV: CrmV2MoreNavItem[] = [
  {
    label: "Communications",
    href: CRM_V2_COMMUNICATIONS_PATH,
    description: "Governed communications bridge",
  },
  { label: "Templates", href: CRM_V2_TEMPLATES_PATH, description: "Document templates" },
  { label: "Settings", href: CRM_V2_SETTINGS_PATH, description: "Workspace settings" },
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
        href: CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
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

/** Paths that resolve to the same nav item (canonical + legacy alias). */
const NAV_PATH_ALIASES: Record<string, string[]> = {
  [CRM_V2_TODAY_PATH]: [CRM_V2_TODAY_PATH, "/advisor-v2/today"],
  [CRM_V2_RELATIONSHIPS_PATH]: [
    CRM_V2_RELATIONSHIPS_PATH,
    "/advisor-v2/relationships",
  ],
  [CRM_V2_APPOINTMENTS_PATH]: [
    CRM_V2_APPOINTMENTS_PATH,
    "/advisor-v2/appointments",
  ],
  [CRM_V2_SERVICE_PATH]: [CRM_V2_SERVICE_PATH, "/advisor-v2/service"],
  [CRM_V2_REPORTS_PATH]: [CRM_V2_REPORTS_PATH, "/advisor-v2/reports"],
  [CRM_V2_OPERATIONS_PATH]: [
    CRM_V2_OPERATIONS_PATH,
    "/advisor-v2/operations",
    CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
    "/advisor-v2/operations/google-calendar",
  ],
  [CRM_V2_COMMUNICATIONS_PATH]: [
    CRM_V2_COMMUNICATIONS_PATH,
    "/advisor-v2/communications",
  ],
  [CRM_V2_TEMPLATES_PATH]: [CRM_V2_TEMPLATES_PATH, "/advisor-v2/templates"],
  [CRM_V2_SETTINGS_PATH]: [
    CRM_V2_SETTINGS_PATH,
    "/advisor-v2/settings",
    CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
    "/advisor-v2/settings/integrations/google-calendar",
  ],
};

function pathnameMatchesNavHref(pathname: string, href: string): boolean {
  const hrefPath = (href.split("?")[0] ?? href).split("#")[0] ?? href;
  const aliases = NAV_PATH_ALIASES[hrefPath];
  if (aliases) {
    return aliases.some(
      (alias) => pathname === alias || pathname.startsWith(`${alias}/`),
    );
  }
  if (hrefPath.startsWith("/advisor/") && !hrefPath.startsWith("/advisor-v2")) {
    return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
  }
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

export function isCrmV2NavActive(pathname: string, href: string): boolean {
  if (href === CRM_V2_HOME_PATH || href === CRM_V2_PILOT_ALIAS_HOME_PATH) {
    return isCrmV2HomePath(pathname);
  }
  return pathnameMatchesNavHref(pathname, href);
}
