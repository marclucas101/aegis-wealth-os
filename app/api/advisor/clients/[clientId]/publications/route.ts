import { NextResponse } from "next/server";

import { canPublishClientOutput } from "@/lib/compliance/entitlements";
import {
  isPlanningOutputPrepareAllowed,
  preparePlanningOutputFromSources,
} from "@/lib/compliance/planningOutputPreparation";
import {
  listPublishedOutputsForClient,
} from "@/lib/compliance/publicationWorkflow";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import type { PublishedOutputType } from "@/lib/compliance/types";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

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

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const { clientId } = await context.params;
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

    const outputs = await listPublishedOutputsForClient(clientId);
    return NextResponse.json({ ok: true, outputs });
  } catch (err) {
    console.error("[api/advisor/clients/[clientId]/publications GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to list publications") },
      { status: 500 },
    );
  }
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

    const { clientId } = await context.params;
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
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Cannot prepare output for this client" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { outputType?: PublishedOutputType };
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const outputType = body.outputType ?? "financial_readiness_snapshot";
    if (!isPlanningOutputPrepareAllowed(outputType)) {
      return NextResponse.json(
        { ok: false, error: "Output type is not supported for preparation" },
        { status: 400 },
      );
    }

    const output = await preparePlanningOutputFromSources({
      client: resolved.client,
      outputType,
      actorUserId: access.authUser.id,
    });

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    console.error("[api/advisor/clients/[clientId]/publications POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to prepare output") },
      { status: 500 },
    );
  }
}
