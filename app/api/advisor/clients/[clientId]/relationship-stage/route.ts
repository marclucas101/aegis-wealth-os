import { NextResponse } from "next/server";

import {
  ADMIN_ONLY_STAGES,
  canAdviserSetStage,
  canClientSelfPromote,
  resolveRelationshipStage,
} from "@/lib/compliance/relationshipStage";
import { updateRelationshipStage } from "@/lib/compliance/publicationWorkflow";
import type { RelationshipStage } from "@/lib/compliance/types";
import { RELATIONSHIP_STAGES } from "@/lib/compliance/types";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

function isValidStage(value: string): value is RelationshipStage {
  return (RELATIONSHIP_STAGES as readonly string[]).includes(value);
}

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role || role === "admin") {
      return NextResponse.json(
        { ok: false, error: "Use admin relationship-stage route for admin users" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { relationshipStage?: string };
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }
    rejectUnexpectedFields(body);

    if (!body.relationshipStage || !isValidStage(body.relationshipStage)) {
      return NextResponse.json(
        { ok: false, error: "Invalid relationshipStage" },
        { status: 400 },
      );
    }

    if (canClientSelfPromote(body.relationshipStage)) {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    if (ADMIN_ONLY_STAGES.includes(body.relationshipStage)) {
      return NextResponse.json(
        { ok: false, error: "Only admin may set this relationship stage" },
        { status: 403 },
      );
    }

    const { clientId } = await context.params;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      "advisor",
      clientId,
    );

    if (resolved.status !== "ok") {
      return NextResponse.json(
        { ok: false, reason: resolved.status },
        { status: resolved.status === "not_found" ? 404 : 403 },
      );
    }

    const currentStage = resolveRelationshipStage(resolved.client);
    if (!canAdviserSetStage(currentStage, body.relationshipStage)) {
      return NextResponse.json(
        { ok: false, error: "Adviser may not set this relationship stage" },
        { status: 403 },
      );
    }

    const result = await updateRelationshipStage(
      clientId,
      body.relationshipStage,
      access.authUser.id,
      "advisor",
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[advisor/relationship-stage PATCH]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update stage") },
      { status: 500 },
    );
  }
}
