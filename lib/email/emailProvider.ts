import "server-only";

import { sendDevEmail } from "./devEmailAdapter";
import { sendResendEmail } from "./resendEmailAdapter";
import type { EmailSendResult, SendEmailInput } from "./types";

function shouldUseProductionEmail(): boolean {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const nodeEnv = process.env.NODE_ENV?.trim();
  const vercelEnv = process.env.VERCEL_ENV?.trim();

  if (!apiKey || !from) {
    return false;
  }

  return nodeEnv === "production" || vercelEnv === "production";
}

export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<EmailSendResult> {
  if (shouldUseProductionEmail()) {
    return sendResendEmail(input);
  }

  return sendDevEmail(input);
}
