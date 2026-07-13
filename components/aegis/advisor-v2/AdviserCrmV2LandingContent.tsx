import AdviserWorkspaceDashboard from "@/components/aegis/advisor-v2/AdviserWorkspaceDashboard";
import {
  assertCrmV2RelationshipsAccess,
  assertCrmV2TodayAccess,
} from "@/lib/crm-v2/access";
import { loadCrmRelationshipListPage } from "@/lib/crm-v2/relationships/listQueries";
import { loadAdviserTodayProjection } from "@/lib/crm-v2/today/projection";

export default async function AdviserCrmV2LandingContent() {
  const todayAccess = await assertCrmV2TodayAccess();
  let today = null;
  if (todayAccess.allowed) {
    const todayResult = await loadAdviserTodayProjection({
      authUserId: todayAccess.authUser.id,
      userRole: todayAccess.user.role as "advisor" | "admin",
    });
    if (todayResult.ok) {
      today = todayResult.data;
    }
  }

  const relationshipsAccess = await assertCrmV2RelationshipsAccess();
  let relationships: Awaited<ReturnType<typeof loadCrmRelationshipListPage>>["relationships"] = [];
  let relationshipsTotalCount: number | null = null;
  if (relationshipsAccess.allowed) {
    try {
      const listPage = await loadCrmRelationshipListPage(
        relationshipsAccess.authUser.id,
        relationshipsAccess.user.role as "advisor" | "admin",
        { page: 1, pageSize: 3 },
      );
      relationships = listPage.relationships;
      relationshipsTotalCount = listPage.totalCount;
    } catch {
      relationships = [];
      relationshipsTotalCount = null;
    }
  }

  return (
    <AdviserWorkspaceDashboard
      today={today}
      todayUnavailable={!todayAccess.allowed}
      relationships={relationships}
      relationshipsTotalCount={relationshipsTotalCount}
      relationshipsUnavailable={!relationshipsAccess.allowed}
    />
  );
}
