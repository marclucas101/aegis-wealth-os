import { NextResponse } from "next/server";

import { updateRelationshipStage } from "@/lib/compliance/publicationWorkflow";
import type { RelationshipStage } from "@/lib/compliance/types";
import { RELATIONSHIP_STAGES } from "@/lib/compliance/types";
import { canClientSelfPromote } from "@/lib/compliance/relationshipStage";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

function isValidStage(value: string): value is RelationshipStage {
  return (RELATIONSHIP_STAGES as readonly string[]).includes(value);
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

    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
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

    const { clientId } = await context.params;

    const result = await updateRelationshipStage(
      clientId,
      body.relationshipStage,
      access.authUser.id,
      "admin",
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/relationship-stage PATCH]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update stage") },
      { status: 500 },
    );
  }
}
