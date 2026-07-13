import { redirect } from "next/navigation";

import { CRM_V2_RELATIONSHIPS_PATH } from "@/lib/crm-v2/navigation";

export default async function AdviserV2AdvocacyAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { relationshipId } = await params;
  const query = await searchParams;
  const paramsQs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") paramsQs.set(key, value);
  }
  const qs = paramsQs.toString();
  redirect(
    `${CRM_V2_RELATIONSHIPS_PATH}/${relationshipId}/advocacy${qs ? `?${qs}` : ""}`,
  );
}
