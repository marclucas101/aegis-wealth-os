import RelationshipListClient from "@/components/aegis/advisor-v2/relationships/RelationshipListClient";
import CrmV2AccessDenied from "@/components/aegis/advisor-v2/CrmV2AccessDenied";
import { assertCrmV2RelationshipsAccess } from "@/lib/crm-v2/access";
import { loadCrmRelationshipListPage } from "@/lib/crm-v2/relationships/listQueries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CrmV2RelationshipsPage() {
  const access = await assertCrmV2RelationshipsAccess();
  if (!access.allowed) {
    return <CrmV2AccessDenied />;
  }

  const initialPage = await loadCrmRelationshipListPage(
    access.authUser.id,
    access.user.role as "advisor" | "admin",
    { page: 1, pageSize: 20 },
  );

  return <RelationshipListClient initialPage={initialPage} />;
}
