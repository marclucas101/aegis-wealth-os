import "server-only";

import type { EmailSendResult, SendEmailInput } from "./types";

export async function sendDevEmail(
  input: SendEmailInput,
): Promise<EmailSendResult> {
  console.info("[email:dev]", {
    to: input.to,
    subject: input.subject,
    preview: input.text.slice(0, 240),
  });

  return { ok: true, messageId: `dev-${Date.now()}` };
}
