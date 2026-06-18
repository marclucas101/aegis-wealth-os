import { NextResponse } from "next/server";

import {
  cronUnauthorizedResponse,
  validateCronSecret,
} from "@/lib/security/cronAuth";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { generateBirthdayReminders } from "@/lib/supabase/birthdayReminderTasks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type GenerateBirthdayRemindersResponse =
  | {
      ok: true;
      scanned: number;
      created: number;
      updated: number;
      expired: number;
      skipped: number;
    }
  | { ok: false; error: string };

export async function GET(
  request: Request,
): Promise<NextResponse<GenerateBirthdayRemindersResponse>> {
  if (!validateCronSecret(request)) {
    return cronUnauthorizedResponse();
  }

  try {
    const counts = await generateBirthdayReminders();

    return NextResponse.json({
      ok: true,
      scanned: counts.scanned,
      created: counts.created,
      updated: counts.updated,
      expired: counts.expired,
      skipped: counts.skipped,
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to generate birthday reminders",
    );
    console.error("[api/internal/tasks/generate-birthday-reminders]", err);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
