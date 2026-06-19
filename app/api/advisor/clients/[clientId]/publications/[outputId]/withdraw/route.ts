import { NextResponse } from "next/server";

import { canPublishClientOutput } from "@/lib/compliance/entitlements";
import { withdrawOutput } from "@/lib/compliance/publicationWorkflow";
import {
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; outputId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

export async function POST(
  request: Request,
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

    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const { clientId, outputId } = await context.params;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      role,
      clientId,
    );

    if (resolved.status !== "ok") {
      return NextResponse.json(
        { ok: false, reason: resolved.status },
        { status: resolved.status === "not_found" ? 404 : 403 },
      );
    }

    const isAssigned = resolved.client.advisor_user_id === access.authUser.id;
    const canPublish = await canPublishClientOutput({
      role: access.user.role,
      isAssignedAdviser: isAssigned,
      isAdmin: role === "admin",
    });

    if (!canPublish) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { reason?: string };
    rejectUnexpectedFields(body);

    const output = await withdrawOutput(
      outputId,
      access.authUser.id,
      clientId,
      body.reason ?? "Withdrawn by adviser",
    );

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    console.error("[publications/withdraw POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to withdraw output") },
      { status: 500 },
    );
  }
}
