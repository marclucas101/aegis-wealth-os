import { NextResponse } from "next/server";

import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { loadProspectHomeData } from "@/lib/compliance/prospectHomeData";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type ProspectHomeResponse =
  | { ok: true; data: Awaited<ReturnType<typeof loadProspectHomeData>> }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<ProspectHomeResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const ctx = await getUserExperienceContext({
      user: session.user,
      client: session.client,
    });

    if (!(await canAccessClientFeature(ctx, "financial_readiness_snapshot"))) {
      return NextResponse.json(
        { ok: false, error: "This page is not available for your account." },
        { status: 403 },
      );
    }

    const data = await loadProspectHomeData({
      user: session.user,
      client: session.client,
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[api/prospect/home]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load prospect home" },
      { status: 500 },
    );
  }
}
