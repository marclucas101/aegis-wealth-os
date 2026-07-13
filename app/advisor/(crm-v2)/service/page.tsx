import ServiceWorkspaceClient from "@/components/aegis/advisor-v2/service/ServiceWorkspaceClient";
import CrmV2ModuleUnavailablePage from "@/components/aegis/advisor-v2/CrmV2ModuleUnavailablePage";
import { assertCrmV2ServiceAccess } from "@/lib/crm-v2/access";
import {
  loadServiceWorkspaceCompleted,
  loadServiceWorkspaceDocumentRequests,
  loadServiceWorkspaceMyWork,
  loadServiceWorkspaceReviews,
  parseServiceWorkspaceView,
} from "@/lib/crm-v2/service/listQueries";
import { listAdviserCommitments, listAdviserServiceRequests } from "@/lib/crm-v2/service/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CrmV2ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const access = await assertCrmV2ServiceAccess();
  if (!access.allowed) {
    return (
      <CrmV2ModuleUnavailablePage
        title="Service"
        reason={access.reason}
        nextStep="When enabled, track commitments, client requests, reviews, and document follow-ups here."
      />
    );
  }

  const params = await searchParams;
  const view = parseServiceWorkspaceView(params.view ?? null);
  const role = access.user.role as "advisor" | "admin";
  const authUserId = access.authUser.id;

  const [myWorkResult, requests, commitments, reviews, documents, completed] =
    await Promise.all([
      loadServiceWorkspaceMyWork({ authUserId, userRole: role }),
      listAdviserServiceRequests({ authUserId, userRole: role, openOnly: true }),
      listAdviserCommitments({ authUserId, userRole: role, openOnly: true }),
      loadServiceWorkspaceReviews({ authUserId, userRole: role }),
      loadServiceWorkspaceDocumentRequests({ authUserId, userRole: role }),
      loadServiceWorkspaceCompleted({ authUserId, userRole: role }),
    ]);

  return (
    <ServiceWorkspaceClient
      initialView={view}
      initialMyWork={myWorkResult.items}
      initialRequests={requests}
      initialCommitments={commitments}
      initialReviews={reviews}
      initialDocuments={documents}
      initialCompleted={completed}
    />
  );
}
