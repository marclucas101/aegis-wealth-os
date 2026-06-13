import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const { clientId } = await context.params;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      clientId,
    );

    if (resolved.status === "not_found") {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    if (resolved.status === "forbidden") {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("adviser_feedback")
      .select(
        "id, status, rating_overall, created_at, updated_at, permission_to_use_as_testimonial, testimonial_anonymous",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to load client feedback: ${error.message}`);
    }

    const feedback = ((data ?? []) as Array<{
      id: string;
      status: string;
      rating_overall: number;
      created_at: string;
      updated_at: string;
      permission_to_use_as_testimonial: boolean;
      testimonial_anonymous: boolean;
    }>).map((row) => ({
      id: row.id,
      status: row.status,
      ratingOverall: row.rating_overall,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      permissionToUseAsTestimonial: row.permission_to_use_as_testimonial,
      testimonialAnonymous: row.testimonial_anonymous,
    }));

    const latest = feedback[0] ?? null;

    return NextResponse.json({
      ok: true,
      feedback,
      latestStatus: latest?.status ?? null,
      hasFeedback: feedback.length > 0,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load client feedback");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
