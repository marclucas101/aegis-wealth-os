import "server-only";

import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";

export async function notifyClientRequestSubmitted(input: {
  clientId: string;
  requestId: string;
  summary: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "adviser_message",
      title: "Request received",
      summary: "Your service request has been submitted to your adviser.",
      referenceType: "client_service_request",
      referenceId: input.requestId,
    });
  } catch {
    // Notification failure must not corrupt authoritative transition.
  }
}

export async function notifyClientRequestAcknowledged(input: {
  clientId: string;
  requestId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "adviser_message",
      title: "Request acknowledged",
      summary: "Your adviser has acknowledged your service request.",
      referenceType: "client_service_request",
      referenceId: input.requestId,
    });
  } catch {
    // Non-blocking.
  }
}

export async function notifyClientRequestInformationRequested(input: {
  clientId: string;
  requestId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "adviser_message",
      title: "More information requested",
      summary: "Your adviser needs additional information to progress your request.",
      referenceType: "client_service_request",
      referenceId: input.requestId,
    });
  } catch {
    // Non-blocking.
  }
}

export async function notifyClientRequestResolved(input: {
  clientId: string;
  requestId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "adviser_message",
      title: "Request resolved",
      summary: "Your service request has been resolved.",
      referenceType: "client_service_request",
      referenceId: input.requestId,
    });
  } catch {
    // Non-blocking.
  }
}

export async function notifyClientCommitmentAssigned(input: {
  clientId: string;
  commitmentId: string;
  title: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "roadmap_task_assigned",
      title: "New action assigned",
      summary: input.title.slice(0, 300),
      referenceType: "service_commitment",
      referenceId: input.commitmentId,
    });
  } catch {
    // Non-blocking.
  }
}

export async function notifyCommitmentDueSoon(input: {
  clientId: string;
  commitmentId: string;
  title: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "roadmap_task_assigned",
      title: "Action due soon",
      summary: input.title.slice(0, 300),
      referenceType: "service_commitment",
      referenceId: input.commitmentId,
    });
  } catch {
    // Non-blocking.
  }
}

export async function notifyDocumentRequested(input: {
  clientId: string;
  commitmentId: string;
  title: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "document_action_required",
      title: "Document requested",
      summary: input.title.slice(0, 300),
      referenceType: "service_commitment",
      referenceId: input.commitmentId,
    });
  } catch {
    // Non-blocking.
  }
}
