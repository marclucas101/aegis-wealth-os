import { NextResponse } from "next/server";

import type { MyClientsListPage } from "@/lib/aegis/myClients";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { loadAdvisorClientListPage } from "@/lib/supabase/advisorClientListQueries";
import type { ClientStatus } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type AdvisorClientsListResponse =
  | ({ ok: true } & MyClientsListPage)
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

const VALID_STATUSES = new Set<ClientStatus | "all">([
  "all",
  "active",
  "onboarding",
  "prospect",
  "review_due",
  "archived",
]);

function parsePage(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request): Promise<NextResponse<AdvisorClientsListResponse>> {
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

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const statusParam = (url.searchParams.get("status") ?? "all") as ClientStatus | "all";
    const status = VALID_STATUSES.has(statusParam) ? statusParam : "all";
    const page = parsePage(url.searchParams.get("page"));
    const pageSize = parsePage(url.searchParams.get("pageSize"));

    const result = await loadAdvisorClientListPage(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      { q, status, page, pageSize },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load clients");
    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
