import { NextResponse } from "next/server";

import type { RoadmapItemStatus } from "@/lib/aegis/localProfile";
import {
  isValidRoadmapStatus,
  persistRoadmapItemStatus,
  type PersistRoadmapStatusResult,
} from "@/lib/supabase/roadmapPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type RoadmapStatusRequestBody = {
  item_key: string;
  status: RoadmapItemStatus;
};

export type RoadmapStatusResponse =
  | ({ ok: true } & PersistRoadmapStatusResult)
  | { ok: false; error: string };

function isValidStatusBody(body: unknown): body is RoadmapStatusRequestBody {
  if (!body || typeof body !== "object") return false;

  const candidate = body as RoadmapStatusRequestBody;
  return (
    typeof candidate.item_key === "string" &&
    candidate.item_key.trim().length > 0 &&
    isValidRoadmapStatus(candidate.status)
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<RoadmapStatusResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (
      body &&
      typeof body === "object" &&
      ("clientId" in body || "client_id" in body)
    ) {
      return NextResponse.json(
        { ok: false, error: "client_id must not be supplied by the client" },
        { status: 400 },
      );
    }

    if (!isValidStatusBody(body)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid item_key or status" },
        { status: 400 },
      );
    }

    const result = await persistRoadmapItemStatus(
      session.client,
      body.item_key.trim(),
      body.status,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update roadmap status";

    console.error("[api/roadmap/status]", message);

    const status = message === "Roadmap item not found" ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
