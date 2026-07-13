import { NextResponse } from "next/server";

import { assertCrmV2CommunicationsAccess } from "@/lib/crm-v2/access";
import {
  createCommunicationDraft,
  loadAdviserCommunicationsWorkspace,
} from "@/lib/crm-v2/communications/communications";
import { parseCommunicationsWorkspaceView } from "@/lib/crm-v2/communications/routes";
import type { CreateCommunicationDraftInput } from "@/lib/crm-v2/communications/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2CommunicationsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const url = new URL(request.url);
    const view = parseCommunicationsWorkspaceView(url.searchParams.get("view") ?? undefined);
    const clientIdFilter = url.searchParams.get("clientId") ?? undefined;

    const result = await loadAdviserCommunicationsWorkspace({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      view,
      clientIdFilter,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        {
          status: result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 400,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, workspace: result.data },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load communications workspace") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2CommunicationsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as CreateCommunicationDraftInput;
    const result = await createCommunicationDraft({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      payload: body,
      requestId: access.requestId,
    });

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "forbidden"
            ? 403
            : result.reason === "conflict"
              ? 409
              : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, record: result.data },
      {
        status: 201,
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to create communication draft") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
