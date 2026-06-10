import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  loadAdminUsers,
  requireAdminAccess,
  type AdminUserRecord,
} from "@/lib/supabase/adminManagement";

export const dynamic = "force-dynamic";

export type AdminUsersResponse =
  | { ok: true; users: AdminUserRecord[] }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

export async function GET(): Promise<NextResponse<AdminUsersResponse>> {
  try {
    const access = await requireAdminAccess();

    if (!access.allowed) {
      if (access.reason === "unauthenticated") {
        return NextResponse.json(
          { ok: false, reason: "unauthenticated" },
          { status: 401 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          reason: "forbidden",
          error: "Admin access required",
        },
        { status: 403 },
      );
    }

    const users = await loadAdminUsers();

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load users");
    console.error("[api/admin/users GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
