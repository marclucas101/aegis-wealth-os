import { NextResponse } from "next/server";

import {
  createAdviserRoadmapAction,
  listAdviserRoadmapActions,
} from "@/lib/supabase/advisorRoadmapActions";
import { privateNoStoreHeaders, rateLimitOrThrow, rejectClientIdInBody } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

function accessError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: { message } }, { status, headers: privateNoStoreHeaders() });
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return accessError(access.reason === "unauthenticated" ? 401 : 403, "Access denied.");
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return accessError(403, "Access denied.");
    }

    const clientId = (await context.params).clientId;
    const resolved = await resolveAccessibleClient(access.authUser.id, role, clientId);
    if (resolved.status !== "ok") {
      return accessError(resolved.status === "not_found" ? 404 : 403, "Access denied.");
    }

    const actions = await listAdviserRoadmapActions(clientId);
    const clientVisibleCount = actions.filter((row) => row.client_visible).length;

    return NextResponse.json(
      { ok: true, actions, clientVisibleCount },
      { headers: privateNoStoreHeaders() },
    );
  } catch {
    return accessError(500, "Unable to load roadmap actions.");
  }
}

export async function POST(
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

    const clientId = (await context.params).clientId;
    const resolved = await resolveAccessibleClient(access.authUser.id, role, clientId);
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

    const title = typeof body.title === "string" ? body.title : "";
    const taskOwner = body.taskOwner === "adviser" ? "adviser" : "client";
    const clientVisible = body.clientVisible !== false;

    const action = await createAdviserRoadmapAction(clientId, {
      title,
      description: typeof body.description === "string" ? body.description : null,
      taskOwner,
      clientVisible,
      status:
        body.status === "in_progress" || body.status === "completed"
          ? body.status
          : "not_started",
      timelineMonths:
        typeof body.timelineMonths === "number" ? body.timelineMonths : undefined,
      priority:
        body.priority === "low" ||
        body.priority === "high" ||
        body.priority === "critical"
          ? body.priority
          : "medium",
      displayCategory:
        typeof body.displayCategory === "string" ? body.displayCategory : null,
    });

    return NextResponse.json({ ok: true, action }, { headers: privateNoStoreHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create roadmap action.";
    return accessError(message.includes("required") ? 400 : 500, message);
  }
}
