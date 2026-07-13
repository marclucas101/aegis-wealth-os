import { AdviserTodayClient } from "@/components/aegis/advisor-v2/today/AdviserTodayClient";
import CrmV2ModuleUnavailablePage from "@/components/aegis/advisor-v2/CrmV2ModuleUnavailablePage";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import { assertCrmV2TodayAccess } from "@/lib/crm-v2/access";
import { loadAdviserTodayProjection } from "@/lib/crm-v2/today/projection";

export default async function CrmV2TodayPage() {
  const access = await assertCrmV2TodayAccess();
  if (!access.allowed) {
    return (
      <CrmV2ModuleUnavailablePage
        title="Today"
        reason={access.reason}
        nextStep="When enabled, Today shows your daily operating view — projections only, not automated actions."
      />
    );
  }

  const result = await loadAdviserTodayProjection({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
  });

  return (
    <>
      <CrmV2PageHeader
        title="Today"
        subtitle="Your daily operating dashboard — safe projections from authoritative CRM sources. Review and act manually."
      />
      <AdviserTodayClient
        initialToday={result.ok ? result.data : null}
        loadError={result.ok ? null : "Unable to load Today workspace."}
        featureDisabled={false}
      />
    </>
  );
}
