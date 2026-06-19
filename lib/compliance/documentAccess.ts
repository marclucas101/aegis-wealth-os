import "server-only";

import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";

export async function assertClientDocumentAccess(
  user: { id: string; role: string },
  client: { id: string; advisor_user_id: string | null; relationship_stage: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getUserExperienceContext({
    user: user as Parameters<typeof getUserExperienceContext>[0]["user"],
    client: client as Parameters<typeof getUserExperienceContext>[0]["client"],
  });

  const canFull = await canAccessClientFeature(ctx, "documents");
  const canLimited = await canAccessClientFeature(ctx, "limited_documents");

  if (!canFull && !canLimited) {
    return { ok: false, error: "Document access is not available." };
  }

  return { ok: true };
}
