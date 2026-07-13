import { AdviserReportsClient } from "@/components/aegis/advisor-v2/reports/AdviserReportsClient";
import CrmV2FoundationPlaceholderPage from "@/components/aegis/advisor-v2/CrmV2FoundationPlaceholderPage";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import { assertCrmV2ReportsAccess } from "@/lib/crm-v2/access";
import { loadAdviserReportsProjection } from "@/lib/crm-v2/reports/projection";

export default async function CrmV2ReportsPage() {
  const access = await assertCrmV2ReportsAccess();
  if (!access.allowed) {
    return (
      <CrmV2FoundationPlaceholderPage
        title="Reports"
        phase="Phase 12"
        message={
          access.reason === "feature_disabled"
            ? "CRM V2 Reports is not enabled."
            : "CRM V2 Reports access is restricted."
        }
      />
    );
  }

  const result = await loadAdviserReportsProjection({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
    requestId: access.requestId,
  });

  return (
    <>
      <CrmV2PageHeader
        title="Reports"
        subtitle="Bounded adviser-facing insight from authoritative CRM sources — projection only."
        phase="Phase 12"
      />
      <AdviserReportsClient
        initialReports={result.ok ? result.data : null}
        loadError={result.ok ? null : "Unable to load reports."}
        featureDisabled={false}
      />
    </>
  );
}
