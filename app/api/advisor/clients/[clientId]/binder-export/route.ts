import { NextResponse } from "next/server";

import { BINDER_SECTIONS, generateBinderExport } from "@/lib/communications/binderExport";
import type { BinderSection } from "@/lib/communications/binderExport";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function POST(
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

    const enabled = await isFeatureEnabled("binder_export");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Binder export is disabled" }, { status: 403 });
    }

    const { clientId } = await context.params;
    const role = access.user.role === "admin" ? "admin" : "advisor";

    const clientAccess = await resolveAccessibleClient(access.user.id, role, clientId);
    if (clientAccess.status !== "ok") {
      return NextResponse.json(
        { ok: false, error: clientAccess.status === "forbidden" ? "Client not assigned" : "Client not found" },
        { status: clientAccess.status === "forbidden" ? 403 : 404 },
      );
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json({ ok: false, error: clientIdReject.error }, { status: 400 });
    }

    rejectUnexpectedFields(parsed.body, { rejectClientId: true });

    const body =
      parsed.body && typeof parsed.body === "object"
        ? (parsed.body as Record<string, unknown>)
        : {};

    const sections = Array.isArray(body.sections)
      ? body.sections.filter((s): s is string => typeof s === "string")
      : [...BINDER_SECTIONS];

    const binder = await generateBinderExport({
      clientId,
      adviserUserId: access.user.id,
      userRole: role,
      meetingDate: typeof body.meetingDate === "string" ? body.meetingDate : null,
      sections: sections as BinderSection[],
    });

    return NextResponse.json({
      ok: true,
      binder: {
        id: binder.id,
        status: binder.status,
        sectionsIncluded: binder.sections_included,
        sourcePublicationIds: binder.source_publication_ids,
        version: binder.version,
        createdAt: binder.created_at,
      },
    });
  } catch (err) {
    console.error("[api/advisor/clients/[clientId]/binder-export POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to generate binder") },
      { status: 500 },
    );
  }
}
