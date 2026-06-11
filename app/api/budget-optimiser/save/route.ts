import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  isValidBudgetDraft,
  persistClientBudget,
  type PersistClientBudgetResult,
} from "@/lib/supabase/budgetPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";
import type { BudgetOptimiserDraft } from "@/src/features/budget-optimiser/formState";

export const dynamic = "force-dynamic";

export type SaveBudgetRequestBody = {
  draft: BudgetOptimiserDraft;
};

export type SaveBudgetResponse =
  | ({ ok: true } & PersistClientBudgetResult)
  | { ok: false; error: string };

function isValidSaveBody(body: unknown): body is SaveBudgetRequestBody {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as SaveBudgetRequestBody;
  return isValidBudgetDraft(candidate.draft);
}

export async function POST(
  request: Request,
): Promise<NextResponse<SaveBudgetResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow<SaveBudgetResponse>(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!isValidSaveBody(parsed.body)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid budget draft fields" },
        { status: 400 },
      );
    }

    const result = await persistClientBudget(
      session.client,
      session.authUser.id,
      parsed.body.draft,
    );

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "client_budget_saved",
      entityType: "client_budgets",
      entityId: result.budgetId,
      metadata: {
        archetype: parsed.body.draft.archetype,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to save budget profile");

    console.error("[api/budget-optimiser/save]", err);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
