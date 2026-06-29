/** Default operational limits for virtual work-queue assembly (Phase 10.2). */
export const WORK_QUEUE_LIMITS = {
  maxClients: 200,
  maxItems: 500,
  appointmentWindowDays: 30,
  appointmentLookbackDays: 7,
  reviewUpcomingDays: 30,
  /** Unpublished draft outputs older than this appear in the queue. */
  unpublishedDraftAgingDays: 14,
  /** Hours before appointment when missing prep surfaces as blocking. */
  preparationLeadHours: 48,
} as const;

/** Review intervals aligned with advisorReviewPipeline.ts (repository evidence). */
export const REVIEW_INTERVAL_MONTHS = {
  due: 12,
  overdue: 15,
} as const;

export const DEFAULT_ADVISER_TIMEZONE = "Asia/Singapore" as const;
