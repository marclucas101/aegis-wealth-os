import type {
  CrmCommunicationChannel,
  CrmCommunicationLifecycleStatus,
  CrmCommunicationTransition,
  TransitionCommunicationInput,
  UpdateCommunicationRecordInput,
} from "@/lib/crm-v2/communications/types";

/** External channels are draft or log only in Phase 10 — no automatic send. */
export const EXTERNAL_DRAFT_CHANNELS = new Set<CrmCommunicationChannel>([
  "email_draft",
  "whatsapp_draft",
  "sms_draft",
  "external_message_log",
]);

export const CHANNEL_CAPABILITIES: Record<
  CrmCommunicationChannel,
  { canDraft: boolean; canLog: boolean; canAutoSend: boolean; clientVisible: boolean }
> = {
  internal_client_message: { canDraft: true, canLog: true, canAutoSend: false, clientVisible: true },
  in_app_notification: { canDraft: true, canLog: true, canAutoSend: false, clientVisible: true },
  email_draft: { canDraft: true, canLog: true, canAutoSend: false, clientVisible: false },
  phone_call_log: { canDraft: false, canLog: true, canAutoSend: false, clientVisible: false },
  meeting_note_reference: { canDraft: false, canLog: true, canAutoSend: false, clientVisible: false },
  whatsapp_draft: { canDraft: true, canLog: true, canAutoSend: false, clientVisible: false },
  sms_draft: { canDraft: true, canLog: true, canAutoSend: false, clientVisible: false },
  external_message_log: { canDraft: false, canLog: true, canAutoSend: false, clientVisible: false },
};

export function isExternalDraftChannel(channel: CrmCommunicationChannel): boolean {
  return EXTERNAL_DRAFT_CHANNELS.has(channel);
}

export function channelAllowsDraft(channel: CrmCommunicationChannel): boolean {
  return CHANNEL_CAPABILITIES[channel].canDraft;
}

export function channelAllowsAutoSend(_channel: CrmCommunicationChannel): boolean {
  return false;
}
