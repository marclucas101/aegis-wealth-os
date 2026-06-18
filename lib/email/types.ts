export type EmailSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};
