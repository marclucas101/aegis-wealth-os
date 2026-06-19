import "server-only";

import { redirect } from "next/navigation";

import {
  assertActiveClientPortalAccess,
} from "@/lib/compliance/activeClientAccess";
import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { isProspectStage, resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import type { ClientFeatureKey } from "@/lib/compliance/types";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

function redirectForDeniedClient(stage: ReturnType<typeof resolveRelationshipStage>): never {
  if (isProspectStage(stage)) {
    redirect("/prospect");
  }
  if (stage === "inactive_client") {
    redirect("/my-adviser");
  }
  redirect("/dashboard");
}

/**
 * Server-side page gate — prevents active-client UI flash for non-active clients.
 * Use on `/my-plan`, `/goals-reviews`, `/insights` and other active-client-only pages.
 */
export async function requireActiveClientPortalPage(): Promise<void> {
  const session = await ensureUserClientProfile();

  if (!session.authenticated) {
    redirect("/login");
  }

  const access = await assertActiveClientPortalAccess({
    user: session.user,
    client: session.client,
  });

  if (!access.allowed) {
    const stage = resolveRelationshipStage(session.client);
    redirectForDeniedClient(stage);
  }
}

/**
 * Entitlement gate for feature pages (e.g. budget) without requiring active_client stage
 * when policy permits — budget is active-client only per entitlements.
 */
export async function requireClientFeaturePage(feature: ClientFeatureKey): Promise<void> {
  const session = await ensureUserClientProfile();

  if (!session.authenticated) {
    redirect("/login");
  }

  const ctx = await getUserExperienceContext({
    user: session.user,
    client: session.client,
  });

  const allowed = await canAccessClientFeature(ctx, feature);
  if (!allowed) {
    const stage = resolveRelationshipStage(session.client);
    redirectForDeniedClient(stage);
  }

  if (feature === "financial_overview" || feature === "my_plan" || feature === "goals_and_reviews") {
    const access = await assertActiveClientPortalAccess({
      user: session.user,
      client: session.client,
    });
    if (!access.allowed) {
      redirectForDeniedClient(resolveRelationshipStage(session.client));
    }
  }
}

export async function assertClientFeatureApiAccess(
  feature: ClientFeatureKey,
  session: Awaited<ReturnType<typeof ensureUserClientProfile>> & { authenticated: true },
): Promise<{ allowed: true } | { allowed: false; status: 403; reason: string }> {
  const ctx = await getUserExperienceContext({
    user: session.user,
    client: session.client,
  });

  const allowed = await canAccessClientFeature(ctx, feature);
  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      reason: "Feature not available for your account",
    };
  }

  return { allowed: true };
}
