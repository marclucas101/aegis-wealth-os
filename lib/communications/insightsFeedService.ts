import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import type { AppClientRow } from "@/lib/supabase/userProfile";
import { dbListPublishedContent } from "@/lib/supabase/governedContentPersistence";
import { dbLoadCommunicationPreferences } from "@/lib/supabase/communicationPreferencesPersistence";

import { contentMatchesAudience } from "./audienceTargeting";
import { toClientSafeInsight } from "./clientSafeInsightsDto";
import type { ClientSafeInsightItem, GovernedContentRow } from "./types";

function preferenceAllowsContent(
  row: GovernedContentRow,
  prefs: Awaited<ReturnType<typeof dbLoadCommunicationPreferences>>,
): boolean {
  if (row.content_type === "promotional_product" && !prefs.promotional_content) {
    return false;
  }
  if (row.category === "market_update" && !prefs.market_updates) {
    return false;
  }
  if (row.category === "event" && !prefs.event_announcements) {
    return false;
  }
  if (row.content_type === "adviser_message" && !prefs.adviser_messages) {
    return false;
  }
  if (row.content_type === "general_education" && !prefs.educational_insights) {
    return false;
  }
  return true;
}

export async function loadClientInsightsFeed(input: {
  client: AppClientRow;
}): Promise<ClientSafeInsightItem[]> {
  const enabled = await isFeatureEnabled("insights_and_updates");
  if (!enabled) {
    return [];
  }

  const stage = resolveRelationshipStage(
    input.client as AppClientRow & { relationship_stage?: string },
  );

  if (!stage) {
    return [];
  }

  const allPublished = await dbListPublishedContent();
  const prefs = await dbLoadCommunicationPreferences(input.client.id);

  const ctx = {
    clientId: input.client.id,
    relationshipStage: stage,
    adviserUserId: input.client.advisor_user_id,
  };

  return allPublished
    .filter((row) => contentMatchesAudience(row, ctx))
    .filter((row) => preferenceAllowsContent(row, prefs))
    .map(toClientSafeInsight);
}

export async function loadClientInsightDetail(input: {
  client: AppClientRow;
  contentId: string;
}): Promise<ClientSafeInsightItem | null> {
  const items = await loadClientInsightsFeed({ client: input.client });
  return items.find((item) => item.id === input.contentId) ?? null;
}
