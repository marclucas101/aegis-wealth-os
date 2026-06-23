import { NextResponse } from "next/server";

import { updateAdviserRoadmapAction } from "@/lib/supabase/advisorRoadmapActions";
import { privateNoStoreHeaders, rateLimitOrThrow, rejectClientIdInBody } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string; actionId: string }> };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

function accessError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: privateNoStoreHeaders() });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return accessError(access.reason === "unauthenticated" ? 401 : 403, "Access denied.");
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
      return accessError(403, "Access denied.");
    }

    const params = await context.params;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      role,
      params.clientId,
    );
    if (resolved.status !== "ok") {
      return accessError(resolved.status === "not_found" ? 404 : 403, "Access denied.");
    }

    if (
      role === "advisor" &&
      resolved.client.advisor_user_id !== access.authUser.id
    ) {
      return accessError(403, "You must be assigned to this client.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return accessError(400, "Invalid request.");
    }

    const action = await updateAdviserRoadmapAction(params.clientId, params.actionId, {
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      taskOwner: body.taskOwner === "adviser" ? "adviser" : body.taskOwner === "client" ? "client" : undefined,
      clientVisible: typeof body.clientVisible === "boolean" ? body.clientVisible : undefined,
      status:
        body.status === "not_started" ||
        body.status === "in_progress" ||
        body.status === "completed"
          ? body.status
          : undefined,
      timelineMonths:
        typeof body.timelineMonths === "number" ? body.timelineMonths : undefined,
      priority:
        body.priority === "low" ||
        body.priority === "medium" ||
        body.priority === "high" ||
        body.priority === "critical"
          ? body.priority
          : undefined,
      displayCategory:
        typeof body.displayCategory === "string" ? body.displayCategory : undefined,
      archive: body.archive === true,
    });

    return NextResponse.json({ ok: true, action }, { headers: privateNoStoreHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update roadmap action.";
    const status = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
    return accessError(status, message);
  }
}
