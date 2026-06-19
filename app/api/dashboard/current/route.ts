import { NextResponse } from "next/server";

import {
  assertNotRawDashboardPayload,
  resolveClientFinancialReadinessAccess,
} from "@/lib/compliance/clientAccessGate";
import type { ClientSafeEnvelope } from "@/lib/compliance/clientSafeDtos";
import type { ClientSafeFinancialReadinessSnapshot } from "@/lib/compliance/clientSafeDtos";
import { safeRecordProspectEvent } from "@/lib/compliance/prospectAnalytics";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DashboardCurrentResponse =
  | {
      ok: true;
      envelope: ClientSafeEnvelope<ClientSafeFinancialReadinessSnapshot | null>;
    }
  | { ok: false; reason: "no_profile" | "unauthenticated" | "forbidden"; error?: string };

export async function GET(): Promise<NextResponse<DashboardCurrentResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const access = await resolveClientFinancialReadinessAccess({
      user: session.user,
      client: session.client,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: access.reason },
        { status: access.status },
      );
    }

    assertNotRawDashboardPayload(
      access.envelope as unknown as Record<string, unknown>,
    );

    if (access.envelope.accessMode === "published") {
      await safeRecordProspectEvent({
        clientId: session.client.id,
        userId: session.authUser.id,
        event: "prospect_published_snapshot_viewed",
        metadata: {
          outputType: access.envelope.outputType,
        },
      });
    }

    return NextResponse.json({ ok: true, envelope: access.envelope });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load dashboard snapshot",
    );

    console.error("[api/dashboard/current]", err);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
