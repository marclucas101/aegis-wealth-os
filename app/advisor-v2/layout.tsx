import CrmV2AccessDenied from "@/components/aegis/advisor-v2/CrmV2AccessDenied";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import { assertCrmV2Access } from "@/lib/crm-v2/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Legacy `/advisor-v2/*` alias layout — access gate only; pages redirect to canonical `/advisor` routes.
 */
export default async function AdviserCrmV2AliasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await assertCrmV2Access();

  if (!access.allowed) {
    if (access.reason === "unauthenticated" || access.reason === "forbidden") {
      return (
        <AuthenticatedAppShell title="Adviser access">
          <AdvisorAccessDenied />
        </AuthenticatedAppShell>
      );
    }

    return (
      <AuthenticatedAppShell title="Adviser Workspace">
        <CrmV2AccessDenied />
      </AuthenticatedAppShell>
    );
  }

  return children;
}
