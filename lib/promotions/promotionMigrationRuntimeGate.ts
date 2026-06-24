import "server-only";

export const PHASE9F4_MIGRATION_RUNTIME_GATE_MESSAGE =
  "Migration execution is restricted until staging concurrency acceptance is completed.";

export const PHASE9F4_MIGRATION_RUNTIME_GATE_CODE =
  "PHASE9F4_MIGRATION_RUNTIME_GATE_INCOMPLETE" as const;

/**
 * Staging concurrency acceptance (`npm run test:phase9f4-migration-idempotency-local`
 * on an approved staging target) must pass before real migration execution is allowed.
 * Default remains false until operator explicitly enables after acceptance.
 */
export function isPhase9f4MigrationRuntimeAcceptanceComplete(): boolean {
  return process.env.PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE === "true";
}

export function isPhase9f4MigrationExecutionRestricted(): boolean {
  return !isPhase9f4MigrationRuntimeAcceptanceComplete();
}
