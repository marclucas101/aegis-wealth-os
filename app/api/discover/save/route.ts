import { NextResponse } from "next/server";

import type {
  RoadmapItemStatus,
  SaveDiscoverProfileInput,
} from "@/lib/aegis/localProfile";
import {
  persistDiscoverProfile,
  type PersistDiscoverResult,
} from "@/lib/supabase/discoverPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type SaveDiscoverRequestBody = SaveDiscoverProfileInput & {
  completedAt?: string;
  roadmapStatuses?: Record<string, RoadmapItemStatus>;
};

export type SaveDiscoverResponse =
  | ({ ok: true } & PersistDiscoverResult)
  | { ok: false; error: string };

function isValidSaveBody(body: unknown): body is SaveDiscoverRequestBody {
  if (!body || typeof body !== "object") return false;

  const candidate = body as SaveDiscoverRequestBody;
  return (
    candidate.formData != null &&
    candidate.completeness != null &&
    typeof candidate.discoverScore === "number" &&
    typeof candidate.dataConfidenceFactor === "number"
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<SaveDiscoverResponse>> {
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

    if (!isValidSaveBody(body)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid discover profile fields" },
        { status: 400 },
      );
    }

    if ("clientId" in body || "client_id" in body) {
      return NextResponse.json(
        { ok: false, error: "client_id must not be supplied by the client" },
        { status: 400 },
      );
    }

    const result = await persistDiscoverProfile(session.client, {
      formData: body.formData,
      completeness: body.completeness,
      discoverScore: body.discoverScore,
      dataConfidenceFactor: body.dataConfidenceFactor,
      completedAt: body.completedAt,
      roadmapStatuses: body.roadmapStatuses,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save discover profile";

    console.error("[api/discover/save]", message);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
