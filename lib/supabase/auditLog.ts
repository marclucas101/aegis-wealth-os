import "server-only";

import { createAdminSupabaseClient } from "./admin";

export type WriteAuditLogInput = {
  clientId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Appends an audit log row via the service-role client.
 * Never throws — failures are logged server-side only.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();

    const { error } = await admin.from("audit_logs").insert({
      client_id: input.clientId ?? null,
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: (input.metadata ?? {}) as never,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    } as never);

    if (error) {
      console.error(
        `[auditLog] Failed to write audit log (${input.action}):`,
        error.message,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[auditLog] Unexpected audit logging failure (${input.action}):`,
      message,
    );
  }
}
