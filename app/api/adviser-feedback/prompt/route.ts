import { NextResponse } from "next/server";

import type { FeedbackPromptState } from "@/lib/aegis/adviserFeedback";
import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  dismissFeedbackPrompt,
  loadFeedbackPromptState,
  markFeedbackPrompted,
} from "@/lib/supabase/adviserFeedbackPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type FeedbackPromptResponse =
  | { ok: true; prompt: FeedbackPromptState }
  | { ok: false; error: string };

export type FeedbackDismissResponse =
  | { ok: true }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<FeedbackPromptResponse>> {
  try {
    const result = await loadFeedbackPromptState();

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    if (result.prompt.shouldPrompt) {
      const session = await ensureUserClientProfile();
      if (session.authenticated) {
        await markFeedbackPrompted(session.client.id);
      }
    }

    return NextResponse.json({ ok: true, prompt: result.prompt });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load feedback prompt");
    console.error("[api/adviser-feedback/prompt GET]", err);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<FeedbackDismissResponse>> {
  try {
    const rateLimit = rateLimitOrThrow<FeedbackDismissResponse>(request, {
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const result = await dismissFeedbackPrompt();

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to dismiss feedback prompt");
    console.error("[api/adviser-feedback/prompt POST]", err);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
