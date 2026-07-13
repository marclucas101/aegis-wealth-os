/** Approved Phase 00 CRM V2 feature-control keys. */
export const CRM_V2_MASTER_FEATURE_KEY = "crm_v2_master" as const;
export const CRM_V2_PILOT_MODE_FEATURE_KEY = "crm_v2_pilot_mode" as const;
export const CRM_V2_RELATIONSHIPS_FEATURE_KEY = "crm_v2_relationships" as const;
export const CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY =
  "crm_v2_appointments_adviser" as const;
export const CRM_V2_APPOINTMENTS_CLIENT_FEATURE_KEY =
  "crm_v2_appointments_client" as const;
export const CRM_V2_GOOGLE_CALENDAR_FEATURE_KEY =
  "crm_v2_google_calendar" as const;
export const CRM_V2_SERVICE_FEATURE_KEY = "crm_v2_service" as const;
export const CRM_V2_CLIENT_SERVICE_FEATURE_KEY =
  "crm_v2_client_service" as const;
export const CRM_V2_PROTECTION_PORTFOLIO_FEATURE_KEY =
  "crm_v2_protection_portfolio" as const;
export const CRM_V2_RELATIONSHIP_MOMENTS_FEATURE_KEY =
  "crm_v2_relationship_moments" as const;
export const CRM_V2_CLIENT_PROFILE_FEATURE_KEY =
  "crm_v2_client_profile" as const;
export const CRM_V2_ADVOCACY_FEATURE_KEY = "crm_v2_advocacy" as const;
export const CRM_V2_COMMUNICATIONS_FEATURE_KEY = "crm_v2_communications" as const;
export const CRM_V2_TODAY_FEATURE_KEY = "crm_v2_today" as const;

export const CRM_V2_PILOT_USER_IDS_ENV = "CRM_V2_PILOT_USER_IDS" as const;

/** Relationship list and 360 bounds (Phase 02). */
export const CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE = 20;
export const CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE = 50;
export const CRM_V2_TIMELINE_MAX_ENTRIES = 50;
export const CRM_V2_SERVICE_MAX_ITEMS = 30;
export const CRM_V2_DOCUMENTS_MAX_SUMMARY = 20;

/** Appointment list bounds (Phase 03). */
export const CRM_V2_APPOINTMENTS_DEFAULT_PAGE_SIZE = 20;
export const CRM_V2_APPOINTMENTS_MAX_PAGE_SIZE = 50;
export const CRM_V2_APPOINTMENTS_MAX_PARTICIPANTS = 8;
export const CRM_V2_APPOINTMENTS_MAX_TOPICS = 20;
export const CRM_V2_APPOINTMENTS_MAX_CHECKLIST_ITEMS = 30;
export const CRM_V2_APPOINTMENTS_MAX_EVENTS = 50;
export const CRM_V2_APPOINTMENTS_LIST_DAYS_AGENDA = 7;
export const CRM_V2_APPOINTMENTS_LIST_DAYS_HISTORY = 90;
export const CRM_V2_APPOINTMENTS_MAX_TITLE_LENGTH = 200;

/** Service workspace bounds (Phase 06). */
export const CRM_V2_SERVICE_MAX_COMMITMENTS = 50;
export const CRM_V2_SERVICE_MAX_EVENTS = 30;
export const CRM_V2_SERVICE_MAX_TITLE_LENGTH = 200;
export const CRM_V2_SERVICE_DEFAULT_PAGE_SIZE = 20;

/** Protection portfolio bounds (Phase 07). */
export const CRM_V2_PROTECTION_MAX_POLICIES = 50;
export const CRM_V2_PROTECTION_MAX_VERSIONS = 30;
export const CRM_V2_PROTECTION_MAX_EXTRACTIONS = 50;
export const CRM_V2_PROTECTION_MAX_EVENTS = 50;
export const CRM_V2_PROTECTION_MAX_TITLE_LENGTH = 200;
export const CRM_V2_PROTECTION_STALE_DAYS = 365;
export const CRM_V2_PROTECTION_VERIFICATION_PERIOD_DAYS = 365;
export const CRM_V2_PROTECTION_DEFAULT_PAGE_SIZE = 20;

/** Relationship moments bounds (Phase 08). */
export const CRM_V2_MOMENTS_MAX_ITEMS = 50;
export const CRM_V2_MOMENTS_MAX_EVENTS = 50;
export const CRM_V2_MOMENTS_MAX_TITLE_LENGTH = 200;
export const CRM_V2_MOMENTS_DEFAULT_PAGE_SIZE = 20;
export const CRM_V2_MOMENTS_UPCOMING_DAYS = 90;

/** Advocacy bounds (Phase 09). */
export const CRM_V2_ADVOCACY_MAX_ITEMS = 50;
export const CRM_V2_ADVOCACY_MAX_EVENTS = 50;
export const CRM_V2_ADVOCACY_MAX_TITLE_LENGTH = 200;
export const CRM_V2_ADVOCACY_DEFAULT_PAGE_SIZE = 20;
export const CRM_V2_ADVOCACY_SUMMARY_YEAR_WINDOW = 1;

/** Communications bounds (Phase 10). */
export const CRM_V2_COMMUNICATIONS_MAX_ITEMS = 50;
export const CRM_V2_COMMUNICATIONS_MAX_SUBJECT_LENGTH = 200;
export const CRM_V2_COMMUNICATIONS_MAX_BODY_LENGTH = 8000;
export const CRM_V2_COMMUNICATIONS_DEFAULT_PAGE_SIZE = 20;

/** Today workspace bounds (Phase 11). */
export const CRM_V2_TODAY_MAX_CARDS_PER_SECTION = 12;
export const CRM_V2_TODAY_MAX_TOTAL_CARDS = 80;
export const CRM_V2_TODAY_WORK_QUEUE_PANEL_ITEMS = 8;
