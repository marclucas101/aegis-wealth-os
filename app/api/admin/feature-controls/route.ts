import { NextResponse } from "next/server";

import {
  loadFeatureControls,
  setFeatureControl,
} from "@/lib/compliance/featureFlags";
import type { PlatformFeatureKey } from "@/lib/compliance/types";
import { PLATFORM_FEATURE_KEYS } from "@/lib/compliance/types";
import {
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const controls = await loadFeatureControls();
    return NextResponse.json({
      ok: true,
      controls: Array.from(controls.values()),
    });
  } catch (err) {
    console.error("[feature-controls GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load controls") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
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

    const body = (await request.json()) as {
      featureKey?: string;
      enabled?: boolean;
      clientVisible?: boolean;
      adviserVisible?: boolean;
    };

    rejectUnexpectedFields(body);

    if (
      !body.featureKey ||
      !(PLATFORM_FEATURE_KEYS as readonly string[]).includes(body.featureKey)
    ) {
      return NextResponse.json({ ok: false, error: "Invalid featureKey" }, { status: 400 });
    }

    const updated = await setFeatureControl(
      body.featureKey as PlatformFeatureKey,
      {
        enabled: body.enabled,
        client_visible: body.clientVisible,
        adviser_visible: body.adviserVisible,
      },
      access.authUser.id,
    );

    await writeAuditLog({
      userId: access.authUser.id,
      action: "admin_feature_control_updated",
      entityType: "platform_feature_control",
      entityId: body.featureKey,
      metadata: {
        enabled: updated.enabled,
        clientVisible: updated.client_visible,
        adviserVisible: updated.adviser_visible,
      },
    });

    return NextResponse.json({ ok: true, control: updated });
  } catch (err) {
    console.error("[feature-controls PATCH]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update control") },
      { status: 500 },
    );
  }
}
