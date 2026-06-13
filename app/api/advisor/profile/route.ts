import { NextResponse } from "next/server";

import type { AdviserProfileFormData } from "@/lib/aegis/myAdviser";
import {
  getRequestMetadata,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdviserOwnProfile,
  upsertAdviserProfile,
} from "@/lib/supabase/adviserProfilePersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

const ALLOWED_PATCH_FIELDS = [
  "displayName",
  "professionalTitle",
  "representingInsurer",
  "organisation",
  "phone",
  "shortBio",
  "yearsExperience",
] as const;

function rejectUnknownProfileFields(
  body: unknown,
): { rejected: true; error: string } | { rejected: false } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { rejected: true, error: "Request body is required" };
  }

  const record = body as Record<string, unknown>;
  const allowed = new Set<string>(ALLOWED_PATCH_FIELDS);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return { rejected: true, error: `Unexpected field: ${key}` };
    }
  }

  return { rejected: false };
}

export type AdviserProfileResponse =
  | { ok: true; profile: AdviserProfileFormData }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

function parseYearsExperience(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  throw new Error("yearsExperience must be a non-negative integer");
}

export async function GET(): Promise<NextResponse<AdviserProfileResponse>> {
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

    const profile = await loadAdviserOwnProfile(access.authUser.id);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load adviser profile");
    console.error("[api/advisor/profile GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
): Promise<NextResponse<AdviserProfileResponse>> {
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

    const rateLimit = rateLimitOrThrow<AdviserProfileResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const unexpected = rejectUnexpectedFields(body);
    if (unexpected.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: unexpected.error },
        { status: 400 },
      );
    }

    const unknownFields = rejectUnknownProfileFields(body);
    if (unknownFields.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: unknownFields.error },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    const update: {
      displayName?: string;
      professionalTitle?: string;
      representingInsurer?: string;
      organisation?: string;
      phone?: string;
      shortBio?: string;
      yearsExperience?: number | null;
    } = {};

    if (typeof payload.displayName === "string") {
      update.displayName = payload.displayName;
    }
    if (typeof payload.professionalTitle === "string") {
      update.professionalTitle = payload.professionalTitle;
    }
    if (typeof payload.representingInsurer === "string") {
      update.representingInsurer = payload.representingInsurer;
    }
    if (typeof payload.organisation === "string") {
      update.organisation = payload.organisation;
    }
    if (typeof payload.phone === "string") {
      update.phone = payload.phone;
    }
    if (typeof payload.shortBio === "string") {
      update.shortBio = payload.shortBio;
    }
    if (payload.yearsExperience !== undefined) {
      update.yearsExperience = parseYearsExperience(payload.yearsExperience);
    }

    const profile = await upsertAdviserProfile(access.authUser.id, update);

    const { ip_address, user_agent } = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_profile_updated",
      entityType: "adviser_profiles",
      entityId: access.authUser.id,
      metadata: { adviser_user_id: access.authUser.id },
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update adviser profile");
    console.error("[api/advisor/profile PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
