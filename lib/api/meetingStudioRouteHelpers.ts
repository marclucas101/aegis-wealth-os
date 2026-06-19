import "server-only";

import { NextResponse } from "next/server";

import { assertMeetingSessionAccess } from "@/lib/compliance/meetingStudioWorkflow";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export { requireAdvisorAccess };

export function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") return role;
  return null;
}

export type AdvisorMeetingAuth =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      authUserId: string;
      role: "advisor" | "admin";
    };

export async function requireAdvisorMeetingAuth(): Promise<AdvisorMeetingAuth> {
  const access = await requireAdvisorAccess();
  if (!access.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      ),
    };
  }

  const role = advisorRole(access.user.role);
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: "forbidden" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, authUserId: access.authUser.id, role };
}

export async function requireClientAccess(
  authUserId: string,
  role: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; client: import("@/lib/supabase/userProfile").AppClientRow }
> {
  const resolved = await resolveAccessibleClient(authUserId, role, clientId);
  if (resolved.status !== "ok") {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: resolved.status },
        { status: resolved.status === "not_found" ? 404 : 403 },
      ),
    };
  }

  if (role === "advisor" && resolved.client.advisor_user_id !== authUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, reason: "forbidden" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, client: resolved.client };
}

export async function requireSessionAccess(
  authUserId: string,
  role: "advisor" | "admin",
  clientId: string,
  sessionId: string,
): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      client: import("@/lib/supabase/userProfile").AppClientRow;
      session: import("@/lib/supabase/meetingSessionPersistence").MeetingSessionRow;
    }
> {
  try {
    const result = await assertMeetingSessionAccess({
      authUserId,
      userRole: role,
      clientId,
      sessionId,
    });
    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message === "not_found" ? 404 : message === "forbidden" ? 403 : 400;
    return {
      ok: false,
      response: NextResponse.json({ ok: false, reason: message }, { status }),
    };
  }
}

export function meetingErrorResponse(
  err: unknown,
  fallback: string,
): NextResponse {
  const message = toPublicErrorMessage(err, fallback);
  const status = message.includes("unavailable")
    ? 503
    : message.includes("not accessible") || message.includes("forbidden")
      ? 403
      : 400;
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Prevent caching of adviser-only meeting payloads on shared devices. */
export function sensitiveMeetingResponse<T>(body: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      ...(init?.headers ?? {}),
    },
  });
}
