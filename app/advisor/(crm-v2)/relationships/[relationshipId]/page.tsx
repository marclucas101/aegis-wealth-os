import Link from "next/link";

import Relationship360View from "@/components/aegis/advisor-v2/relationships/Relationship360View";
import CrmV2AccessDenied from "@/components/aegis/advisor-v2/CrmV2AccessDenied";
import { assertCrmV2RelationshipsAccess } from "@/lib/crm-v2/access";
import { resolveAuthorizedRelationship } from "@/lib/crm-v2/relationships/identity";
import { loadCrmRelationship360 } from "@/lib/crm-v2/relationships/readModel";
import { buildRelationshipListHref, parseRelationshipTab } from "@/lib/crm-v2/relationships/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function CrmV2RelationshipDetailPage({
  params,
  searchParams,
}: PageProps) {
  const access = await assertCrmV2RelationshipsAccess();
  if (!access.allowed) {
    return <CrmV2AccessDenied />;
  }

  const { relationshipId } = await params;
  const resolved = await resolveAuthorizedRelationship(
    access.authUser.id,
    access.user.role as "advisor" | "admin",
    relationshipId,
  );

  if (!resolved.ok) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 px-6 py-10 text-center">
        <h1 className="text-sm font-light text-[#F3F1EA]">Relationship unavailable</h1>
        <p className="mt-2 text-xs text-[#F3F1EA]/45">
          This relationship could not be loaded with your current access.
        </p>
        <Link
          href={buildRelationshipListHref()}
          className="mt-4 inline-block text-sm text-[#D1A866]/85 underline-offset-2 hover:underline"
        >
          Back to Relationships
        </Link>
      </div>
    );
  }

  const query = await searchParams;
  const tab = parseRelationshipTab(query.tab);
  const model = await loadCrmRelationship360(
    resolved.client,
    tab,
    access.requestId,
  );

  return <Relationship360View model={model} />;
}
