import type { ReactNode } from "react";

import AppShell from "@/components/aegis/AppShell";
import {
  getClientEntitlements,
  getNavSectionsForEntitlements,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { getNavSectionsForRole } from "@/lib/navigation";
import { getCurrentUserRole } from "@/lib/supabase/authGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

interface AuthenticatedAppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  fullBleed?: boolean;
}

/**
 * Server wrapper that resolves authoritative entitlements and passes
 * entitlement-filtered navigation into the client AppShell.
 */
export default async function AuthenticatedAppShell({
  children,
  title,
  subtitle,
  fullBleed,
}: AuthenticatedAppShellProps) {
  const userRole = await getCurrentUserRole();
  const session = await ensureUserClientProfile();

  let navSections = getNavSectionsForRole(userRole);

  if (session.authenticated && session.user.role === "client") {
    const ctx = await getUserExperienceContext({
      user: session.user,
      client: session.client,
    });
    const entitlements = await getClientEntitlements(ctx);
    navSections = getNavSectionsForEntitlements(userRole, entitlements);
  }

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
