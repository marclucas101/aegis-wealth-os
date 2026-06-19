import { NextResponse } from "next/server";

import { assertClientFeatureApiAccess } from "@/lib/compliance/activeClientPageGate";
import { CLIENT_API_CACHE_HEADERS } from "@/lib/compliance/activeClientAccess";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { loadCurrentClientBudget } from "@/lib/supabase/budgetPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";
import type { SavedBudgetAccountRecord } from "@/src/features/budget-optimiser/accountPersistence";

export const dynamic = "force-dynamic";

export type CurrentBudgetResponse =
  | { ok: true; budget: SavedBudgetAccountRecord }
  | { ok: false; error?: string; budget?: null };

function toAccountRecord(
  saved: NonNullable<Awaited<ReturnType<typeof loadCurrentClientBudget>>>,
): SavedBudgetAccountRecord {
  return {
    id: saved.id,
    clientId: saved.clientId,
    archetype: saved.archetype,
    age: saved.age,
    monthlyIncome: saved.monthlyIncome,
    currency: saved.currency,
    entries: saved.entries,
    updatedAt: saved.updatedAt,
    createdAt: saved.createdAt,
    isCurrent: saved.isCurrent,
  };
}

export async function GET(): Promise<NextResponse<CurrentBudgetResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required", budget: null },
        { status: 401, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const featureAccess = await assertClientFeatureApiAccess("budget", session);
    if (!featureAccess.allowed) {
      return NextResponse.json(
        { ok: false, error: featureAccess.reason, budget: null },
        { status: featureAccess.status, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const current = await loadCurrentClientBudget(session.client.id);

    if (!current) {
      return NextResponse.json(
        { ok: false, budget: null },
        { headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        budget: toAccountRecord(current),
      },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load budget profile");

    console.error("[api/budget-optimiser/current]", err);

    return NextResponse.json(
      { ok: false, error: message, budget: null },
      { status: 500 },
    );
  }
}
