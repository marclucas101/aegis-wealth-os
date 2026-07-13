import { AdviserOperationsClient } from "@/components/aegis/advisor-v2/operations/AdviserOperationsClient";
import CrmV2FoundationPlaceholderPage from "@/components/aegis/advisor-v2/CrmV2FoundationPlaceholderPage";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import { assertCrmV2OperationsAccess } from "@/lib/crm-v2/access";
import { loadAdviserOperationsProjection } from "@/lib/crm-v2/operations/projection";

export default async function CrmV2OperationsPage() {
  const access = await assertCrmV2OperationsAccess();
  if (!access.allowed) {
    return (
      <CrmV2FoundationPlaceholderPage
        title="Operations"
        phase="Phase 12"
        message={
          access.reason === "feature_disabled"
            ? "CRM V2 Operations is not enabled."
            : "CRM V2 Operations access is restricted."
        }
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
        phase="Phase 12"
      />
      <AdviserOperationsClient
        initialOperations={result.ok ? result.data : null}
        loadError={result.ok ? null : "Unable to load operations."}
        featureDisabled={false}
      />
    </>
  );
}
