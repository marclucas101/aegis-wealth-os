import "server-only";

import { fetchWithTimeout } from "@/lib/server/fetchWithTimeout";

import type { EmailSendResult, SendEmailInput } from "./types";

export async function sendResendEmail(
  input: SendEmailInput,
): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email provider is not configured",
    };
  }

  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: body || `Email provider returned ${response.status}`,
    };
  }

  const payload = (await response.json()) as { id?: string };
  return { ok: true, messageId: payload.id };
}
