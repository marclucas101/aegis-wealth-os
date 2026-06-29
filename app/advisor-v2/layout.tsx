import AdviserCrmV2Shell from "@/components/aegis/advisor-v2/AdviserCrmV2Shell";
import CrmV2AccessDenied from "@/components/aegis/advisor-v2/CrmV2AccessDenied";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import AdvisorAccessDenied from "@/components/aegis/advisor/AdvisorAccessDenied";
import { assertCrmV2Access } from "@/lib/crm-v2/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdviserCrmV2Layout({
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
      <AuthenticatedAppShell title="Adviser CRM V2">
        <CrmV2AccessDenied />
      </AuthenticatedAppShell>
    );
  }

  return <AdviserCrmV2Shell>{children}</AdviserCrmV2Shell>;
}
