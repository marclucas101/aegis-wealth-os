import type { UserRole } from "@/lib/roles";
import { isAdvisorRole } from "@/lib/roles";

export interface NavItem {
  label: string;
  href: string;
  description?: string;
  /** Visible to advisors and admins only. */
  advisorOnly?: boolean;
  /** Visible to clients only (hidden from advisers and admins). */
  clientOnly?: boolean;
  /** Visible to admins only. */
  adminOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const ADVISORY_SECTION_TITLE = "Advisory";

/** Focused prospect navigation — filtered server-side via entitlements. */
export const PROSPECT_NAV_SECTIONS: NavSection[] = [
  {
    title: "Your journey",
    items: [
      {
        label: "Home",
        href: "/prospect",
        description: "Your prospect overview",
        clientOnly: true,
      },
      {
        label: "Complete My Information",
        href: "/discover",
        description: "Progressive financial profile",
        clientOnly: true,
      },
      {
        label: "My Snapshot",
        href: "/dashboard",
        description: "Financial readiness snapshot",
        clientOnly: true,
      },
      {
        label: "Prepare for My Meeting",
        href: "/meeting-preparation",
        description: "Meeting checklist and guidance",
        clientOnly: true,
      },
      {
        label: "My Adviser",
        href: "/my-adviser",
        description: "Your assigned adviser",
        clientOnly: true,
      },
      {
        label: "Documents",
        href: "/document-vault",
        description: "Upload and view documents",
        clientOnly: true,
      },
    ],
  },
];

/**
 * Full navigation catalogue. Filter with {@link getNavSectionsForRole} before
 * rendering — never show the raw list to unauthenticated or client users.
 *
 * Future adviser routes should set `advisorOnly: true` when added. Adviser
 * profile, calendar, and booking setup are consolidated under "My Profile"
 * (`/advisor/my-profile`).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", description: "Shield overview" },
      {
        label: "Profile",
        href: "/profile",
        description: "Account & client record",
      },
      {
        label: "My Adviser",
        href: "/my-adviser",
        description: "Your assigned adviser",
        clientOnly: true,
      },
    ],
  },
  {
    title: "Architecture",
    items: [
      { label: "Discover", href: "/discover", description: "Financial profile" },
      {
        label: "Shield Diagnostic",
        href: "/shield-diagnostic",
        description: "Composite assessment",
      },
      {
        label: "Stress Testing",
        href: "/stress-testing",
        description: "Scenario simulations",
      },
      { label: "Roadmap", href: "/roadmap", description: "Priority actions" },
      {
        label: "Budget Optimiser",
        href: "/budget-optimiser",
        description: "Capital allocation discipline",
      },
    ],
  },
  {
    title: "Deliverables",
    items: [
      {
        label: "Annual Review",
        href: "/annual-review",
        description: "Shield progression",
      },
      {
        label: "Wealth Blueprint",
        href: "/wealth-blueprint",
        description: "Institutional reports",
      },
      {
        label: "Document Vault",
        href: "/document-vault",
        description: "Architecture records",
      },
      {
        label: "Promotions",
        href: "/promotions",
        description: "Curated opportunities",
      },
    ],
  },
  {
    title: ADVISORY_SECTION_TITLE,
    items: [
      {
        label: "Advisor OS",
        href: "/advisor",
        description: "Client monitoring",
        advisorOnly: true,
      },
      {
        label: "My Clients",
        href: "/advisor/clients",
        description: "Assigned client roster",
        advisorOnly: true,
      },
      {
        label: "Appointments",
        href: "/advisor/appointments",
        description: "Manage client bookings",
        advisorOnly: true,
      },
      {
        label: "Promotions Manager",
        href: "/advisor/promotions",
        description: "Campaigns & opportunities",
        advisorOnly: true,
      },
      {
        label: "Client Feedback",
        href: "/advisor/feedback",
        description: "Experience & testimonials",
        advisorOnly: true,
      },
      {
        label: "Protection Report",
        href: "/advisor/protection-report",
        description: "Portfolio summary generator",
        advisorOnly: true,
      },
      {
        label: "My Profile",
        href: "/advisor/my-profile",
        description: "Profile, calendar & booking setup",
        advisorOnly: true,
      },
      {
        label: "Admin Console",
        href: "/admin",
        description: "Roles & assignments",
        adminOnly: true,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(
  (section) => section.items,
);

export function isNavItemVisibleForRole(
  item: NavItem,
  role: UserRole | null,
): boolean {
  if (item.adminOnly) {
    return role === "admin";
  }

  if (item.clientOnly) {
    return role === "client";
  }

  if (item.advisorOnly) {
    return role !== null && isAdvisorRole(role);
  }

  return true;
}

export function getNavSectionsForRole(role: UserRole | null): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isNavItemVisibleForRole(item, role)),
  })).filter((section) => section.items.length > 0);
}
