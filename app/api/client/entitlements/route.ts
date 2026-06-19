import { NextResponse } from "next/server";

import {
  getClientEntitlements,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const ctx = await getUserExperienceContext({
      user: session.user,
      client: session.client,
    });
    const entitlements = await getClientEntitlements(ctx);

    return NextResponse.json({
      ok: true,
      experienceContext: ctx,
      entitlements,
      relationshipStage: resolveRelationshipStage(session.client),
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to resolve entitlements");
    console.error("[api/client/entitlements]", err);
    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
