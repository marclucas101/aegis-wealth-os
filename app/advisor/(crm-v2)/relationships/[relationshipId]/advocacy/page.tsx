import { RelationshipAdvocacyClient } from "@/components/aegis/advisor-v2/advocacy/RelationshipAdvocacyClient";
import { assertCrmV2AdvocacyAccess } from "@/lib/crm-v2/access";
import { loadAdviserAdvocacyWorkspace } from "@/lib/crm-v2/advocacy/advocacy";
import { parseAdvocacyWorkspaceView } from "@/lib/crm-v2/advocacy/routes";

type PageProps = {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RelationshipAdvocacyPage({ params, searchParams }: PageProps) {
  const { relationshipId } = await params;
  const query = await searchParams;
  const view = parseAdvocacyWorkspaceView(typeof query.view === "string" ? query.view : undefined);

  const access = await assertCrmV2AdvocacyAccess();
  if (!access.allowed) {
    return (
      <RelationshipAdvocacyClient
        relationshipId={relationshipId}
        initialView={view}
        initialWorkspace={null}
        loadError="Advocacy is not available."
      />
    );
  }

  const workspaceResult = await loadAdviserAdvocacyWorkspace({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
    relationshipId,
  });

  return (
    <RelationshipAdvocacyClient
      relationshipId={relationshipId}
      initialView={view}
      initialWorkspace={workspaceResult.ok ? workspaceResult.data : null}
      loadError={workspaceResult.ok ? null : "Unable to load advocacy workspace."}
    />
  );
}
