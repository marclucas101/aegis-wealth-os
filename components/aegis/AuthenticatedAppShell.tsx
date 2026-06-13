import type { ReactNode } from "react";

import AppShell from "@/components/aegis/AppShell";
import { getNavSectionsForRole } from "@/lib/navigation";
import { getCurrentUserRole } from "@/lib/supabase/authGuards";

interface AuthenticatedAppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  fullBleed?: boolean;
}

/**
 * Server wrapper that resolves the authoritative user role and passes
 * role-filtered navigation into the client AppShell.
 */
export default async function AuthenticatedAppShell({
  children,
  title,
  subtitle,
  fullBleed,
}: AuthenticatedAppShellProps) {
  const userRole = await getCurrentUserRole();
  const navSections = getNavSectionsForRole(userRole);

  return (
    <AppShell
      title={title}
      subtitle={subtitle}
      fullBleed={fullBleed}
      navSections={navSections}
    >
      {children}
    </AppShell>
  );
}
