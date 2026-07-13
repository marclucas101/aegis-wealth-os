import { redirect } from "next/navigation";

import { CRM_V2_RELATIONSHIPS_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2RelationshipDetailAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { relationshipId } = await params;
  const query = await searchParams;
  const qs = query.tab ? `?tab=${encodeURIComponent(query.tab)}` : "";
  redirect(`${CRM_V2_RELATIONSHIPS_PATH}/${relationshipId}${qs}`);
}
