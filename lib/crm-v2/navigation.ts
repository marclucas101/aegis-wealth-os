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

export const CRM_V2_DOMAIN_PILLARS = [
  { label: "Relationship", description: "Who you serve" },
  { label: "Engagement", description: "How you connect" },
  { label: "Advice", description: "What you plan" },
  { label: "Service", description: "What you deliver" },
] as const;

export function isCrmV2NavActive(pathname: string, href: string): boolean {
  if (href === "/advisor-v2/today") {
    return pathname === "/advisor-v2/today" || pathname === "/advisor-v2";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
