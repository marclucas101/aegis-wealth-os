import "server-only";

import {
  isPhase9f4MigrationExecutionRestricted,
  isPhase9f4MigrationRuntimeAcceptanceComplete,
  PHASE9F4_MIGRATION_RUNTIME_GATE_MESSAGE,
} from "./promotionMigrationRuntimeGate";

export type PromotionMigrationAdminRetirementContext = {
  legacyPromotionsRetired: true;
  sourceRowCount: number;
  unmigratedQueueCount: number;
  migrationRuntimeAcceptanceComplete: boolean;
  migrationExecutionRestricted: boolean;
  runtimeGateMessage: string;
};

export function buildPromotionMigrationAdminRetirementContext(input: {
  sourceRowCount: number;
  unmigratedQueueCount: number;
}): PromotionMigrationAdminRetirementContext {
  return {
    legacyPromotionsRetired: true,
    sourceRowCount: input.sourceRowCount,
    unmigratedQueueCount: input.unmigratedQueueCount,
    migrationRuntimeAcceptanceComplete: isPhase9f4MigrationRuntimeAcceptanceComplete(),
    migrationExecutionRestricted: isPhase9f4MigrationExecutionRestricted(),
    runtimeGateMessage: PHASE9F4_MIGRATION_RUNTIME_GATE_MESSAGE,
  };
}
