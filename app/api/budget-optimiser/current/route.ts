import { NextResponse } from "next/server";

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
        { status: 401 },
      );
    }

    const current = await loadCurrentClientBudget(session.client.id);

    if (!current) {
      return NextResponse.json({ ok: false, budget: null });
    }

    return NextResponse.json({
      ok: true,
      budget: toAccountRecord(current),
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load budget profile");

    console.error("[api/budget-optimiser/current]", err);

    return NextResponse.json(
      { ok: false, error: message, budget: null },
      { status: 500 },
    );
  }
}
