import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { listClientBudgetSnapshots } from "@/lib/supabase/budgetPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";
import type { SavedBudgetAccountRecord } from "@/src/features/budget-optimiser/accountPersistence";

export const dynamic = "force-dynamic";

export type BudgetHistoryResponse =
  | { ok: true; snapshots: SavedBudgetAccountRecord[] }
  | { ok: false; error: string };

function toAccountRecord(
  saved: Awaited<ReturnType<typeof listClientBudgetSnapshots>>[number],
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

export async function GET(): Promise<NextResponse<BudgetHistoryResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const snapshots = await listClientBudgetSnapshots(session.client.id, 10);

    return NextResponse.json({
      ok: true,
      snapshots: snapshots.map(toAccountRecord),
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load budget history",
    );

    console.error("[api/budget-optimiser/history]", err);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
