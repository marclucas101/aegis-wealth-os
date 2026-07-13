import { RelationshipMomentsClient } from "@/components/aegis/advisor-v2/moments/RelationshipMomentsClient";
import { assertCrmV2RelationshipMomentsAccess } from "@/lib/crm-v2/access";
import { loadAdviserMomentsWorkspace } from "@/lib/crm-v2/moments/moments";
import { parseMomentsWorkspaceView } from "@/lib/crm-v2/moments/routes";

type PageProps = {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RelationshipMomentsPage({ params, searchParams }: PageProps) {
  const { relationshipId } = await params;
  const query = await searchParams;
  const view = parseMomentsWorkspaceView(typeof query.view === "string" ? query.view : undefined);

  const access = await assertCrmV2RelationshipMomentsAccess();
  if (!access.allowed) {
    return (
      <RelationshipMomentsClient
        relationshipId={relationshipId}
        initialView={view}
        initialWorkspace={null}
        loadError="Relationship moments are not available."
      />
    );
  }

  const workspaceResult = await loadAdviserMomentsWorkspace({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
    relationshipId,
  });

  return (
    <RelationshipMomentsClient
      relationshipId={relationshipId}
      initialView={view}
      initialWorkspace={workspaceResult.ok ? workspaceResult.data : null}
      loadError={workspaceResult.ok ? null : "Unable to load moments workspace."}
    />
  );
}
