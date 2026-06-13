import { NextResponse } from "next/server";

import type { AdviserProfileFormData } from "@/lib/aegis/myAdviser";
import {
  getRequestMetadata,
  rateLimitOrThrow,
  rejectClientIdInFormData,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { uploadAdviserProfilePhoto } from "@/lib/supabase/adviserProfilePersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdviserProfilePhotoResponse =
  | { ok: true; profile: AdviserProfileFormData }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

export async function POST(
  request: Request,
): Promise<NextResponse<AdviserProfilePhotoResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const rateLimit = rateLimitOrThrow<AdviserProfilePhotoResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid form data" },
        { status: 400 },
      );
    }

    const rejected = rejectClientIdInFormData(formData);
    if (rejected.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: rejected.error },
        { status: 400 },
      );
    }

    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Missing photo file" },
        { status: 400 },
      );
    }

    const profile = await uploadAdviserProfilePhoto(access.authUser.id, file);

    const { ip_address, user_agent } = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_profile_photo_uploaded",
      entityType: "adviser_profiles",
      entityId: access.authUser.id,
      metadata: { adviser_user_id: access.authUser.id },
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to upload adviser photo");
    console.error("[api/advisor/profile/photo POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
