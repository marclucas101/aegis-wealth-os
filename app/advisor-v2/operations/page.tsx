import { AdviserOperationsClient } from "@/components/aegis/advisor-v2/operations/AdviserOperationsClient";
import CrmV2ModuleUnavailablePage from "@/components/aegis/advisor-v2/CrmV2ModuleUnavailablePage";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import { assertCrmV2OperationsAccess } from "@/lib/crm-v2/access";
import { loadAdviserOperationsProjection } from "@/lib/crm-v2/operations/projection";

export default async function CrmV2OperationsPage() {
  const access = await assertCrmV2OperationsAccess();
  if (!access.allowed) {
    return (
      <CrmV2ModuleUnavailablePage
        title="Operations"
        reason={access.reason}
        nextStep="When enabled, review platform health, sync status, and exceptions here."
      />
    );
  }

  const result = await loadAdviserOperationsProjection({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
    requestId: access.requestId,
  });

  return (
    <>
      <CrmV2PageHeader
        title="Operations"
        subtitle="Platform health, sync, migration and exception visibility — safe projections only."
      />
      <AdviserOperationsClient
        initialOperations={result.ok ? result.data : null}
        loadError={result.ok ? null : "Unable to load operations."}
        featureDisabled={false}
      />
    </>
  );
}
