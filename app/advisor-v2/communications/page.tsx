import { AdviserCommunicationsClient } from "@/components/aegis/advisor-v2/communications/AdviserCommunicationsClient";
import { assertCrmV2CommunicationsAccess } from "@/lib/crm-v2/access";
import { loadAdviserCommunicationsWorkspace } from "@/lib/crm-v2/communications/communications";
import { parseCommunicationsWorkspaceView } from "@/lib/crm-v2/communications/routes";
import CrmV2FoundationPlaceholderPage from "@/components/aegis/advisor-v2/CrmV2FoundationPlaceholderPage";

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function CrmV2CommunicationsPage({ searchParams }: PageProps) {
  const access = await assertCrmV2CommunicationsAccess();
  if (!access.allowed) {
    return (
      <CrmV2FoundationPlaceholderPage
        title="Communications"
        phase="Phase 10"
        message={
          access.reason === "feature_disabled"
            ? "CRM V2 communications is not enabled."
            : "CRM V2 communications access is restricted."
        }
      />
    );
  }

  const params = await searchParams;
  const view = parseCommunicationsWorkspaceView(params.view);
  const result = await loadAdviserCommunicationsWorkspace({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
    view,
  });

  return (
    <AdviserCommunicationsClient
      initialView={view}
      initialWorkspace={result.ok ? result.data : null}
      loadError={result.ok ? null : "Unable to load communications workspace."}
    />
  );
}
