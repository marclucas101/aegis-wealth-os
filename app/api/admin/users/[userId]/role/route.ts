import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  isValidUuid,
  rejectForbiddenIdentityFields,
  requireAdminAccess,
  updateUserRole,
  type AdminUserRecord,
} from "@/lib/supabase/adminManagement";
import type { UserRole } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["client", "advisor", "admin"] as const;

export type AdminUserRoleResponse =
  | { ok: true; user: AdminUserRecord; oldRole: UserRole; newRole: UserRole }
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "invalid_role"
        | "forbidden_self_demote"
        | "unchanged"
        | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdminUserRoleResponse>> {
  try {
    const access = await requireAdminAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Admin access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const { userId } = await context.params;

    if (!isValidUuid(userId)) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid user id" },
        { status: 400 },
      );
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectForbiddenIdentityFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: forbidden.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const roleResult = validateEnum<UserRole>(
      body.role,
      ALLOWED_ROLES,
      "role",
    );

    if (!roleResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "invalid_role", error: roleResult.error },
        { status: 400 },
      );
    }

    const result = await updateUserRole(
      access.authUser.id,
      userId,
      roleResult.value,
    );

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "forbidden_self_demote"
            ? 403
            : result.reason === "unchanged"
              ? 409
              : 400;

      const errorMessages: Record<string, string> = {
        not_found: "User not found",
        forbidden_self_demote:
          "Cannot demote your own admin account while you are the only admin",
        unchanged: "Role is already set to this value",
        invalid_role: "Invalid role",
      };

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error: errorMessages[result.reason] ?? "Failed to update role",
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "user_role_updated",
      entityType: "users",
      entityId: userId,
      metadata: {
        target_user_id: userId,
        old_role: result.oldRole,
        new_role: result.newRole,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({
      ok: true,
      user: result.user,
      oldRole: result.oldRole,
      newRole: result.newRole,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update user role");
    console.error("[api/admin/users/[userId]/role PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
