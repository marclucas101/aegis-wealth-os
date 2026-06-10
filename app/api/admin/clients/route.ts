import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  loadAdminClients,
  requireAdminAccess,
  type AdminClientRecord,
} from "@/lib/supabase/adminManagement";

export const dynamic = "force-dynamic";

export type AdminClientsResponse =
  | { ok: true; clients: AdminClientRecord[] }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

export async function GET(): Promise<NextResponse<AdminClientsResponse>> {
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

    const clients = await loadAdminClients();

    return NextResponse.json({ ok: true, clients });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load clients");
    console.error("[api/admin/clients GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
