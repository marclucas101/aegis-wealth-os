import { NextResponse } from "next/server";

import {
  persistWealthBlueprintSnapshot,
  type PersistReportSnapshotResult,
} from "@/lib/supabase/reportPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type WealthBlueprintSaveResponse =
  | ({ ok: true } & PersistReportSnapshotResult)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

function rejectsClientId(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    ("clientId" in body || "client_id" in body)
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<WealthBlueprintSaveResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    let body: unknown = null;
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text) as unknown;
      }
    } catch {
      return NextResponse.json(
        { ok: false, reason: "no_profile", error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (rejectsClientId(body)) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: "client_id must not be supplied by the client",
        },
        { status: 400 },
      );
    }

    const result = await persistWealthBlueprintSnapshot(session.client);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to save wealth blueprint snapshot";

    if (message === "no_profile") {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    console.error("[api/wealth-blueprint/save]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
