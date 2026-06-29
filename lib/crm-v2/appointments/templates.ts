import type { CalendarLocationType } from "@/lib/aegis/calendar";

export type CrmAppointmentTemplateKey =
  | "prospect_consultation"
  | "discovery"
  | "data_gathering"
  | "planning_presentation"
  | "annual_review"
  | "protection_review"
  | "policy_servicing"
  | "general_check_in";

export type CrmAppointmentChecklistTemplateItem = {
  key: string;
  label: string;
  required: boolean;
  owner: "adviser" | "client" | "shared";
  visibility: "adviser" | "client" | "shared";
  sortOrder: number;
};

export type CrmAppointmentTemplate = {
  key: CrmAppointmentTemplateKey;
  displayName: string;
  defaultDurationMinutes: number;
  deliveryModes: CalendarLocationType[];
  defaultAgendaPrompts: string[];
  requiredDocumentCategories: string[];
  followUpExpectation: string;
  checklistItems: CrmAppointmentChecklistTemplateItem[];
  active: boolean;
};

const BASE_CHECKLIST: CrmAppointmentChecklistTemplateItem[] = [
  {
    key: "review_relationship_context",
    label: "Review relationship context",
    required: true,
    owner: "adviser",
    visibility: "adviser",
    sortOrder: 10,
  },
  {
    key: "confirm_meeting_objective",
    label: "Confirm meeting objective",
    required: true,
    owner: "adviser",
    visibility: "adviser",
    sortOrder: 20,
  },
];

export const CRM_APPOINTMENT_TEMPLATES: Record<
  CrmAppointmentTemplateKey,
  CrmAppointmentTemplate
> = {
  prospect_consultation: {
    key: "prospect_consultation",
    displayName: "Prospect consultation",
    defaultDurationMinutes: 45,
    deliveryModes: ["google_meet", "physical", "phone"],
    defaultAgendaPrompts: ["Introduction", "Goals discussion", "Next steps"],
    requiredDocumentCategories: [],
    followUpExpectation: "Confirm whether to proceed to discovery",
    checklistItems: [
      ...BASE_CHECKLIST,
      {
        key: "prepare_intro_materials",
        label: "Prepare introduction materials",
        required: false,
        owner: "adviser",
        visibility: "adviser",
        sortOrder: 30,
      },
    ],
    active: true,
  },
  discovery: {
    key: "discovery",
    displayName: "Discovery",
    defaultDurationMinutes: 60,
    deliveryModes: ["google_meet", "physical"],
    defaultAgendaPrompts: ["Fact-find overview", "Priority areas", "Data needs"],
    requiredDocumentCategories: ["identity"],
    followUpExpectation: "Schedule data gathering if needed",
    checklistItems: [
      ...BASE_CHECKLIST,
      {
        key: "review_discover_status",
        label: "Review Discover completion status",
        required: true,
        owner: "adviser",
        visibility: "adviser",
        sortOrder: 30,
      },
    ],
    active: true,
  },
  data_gathering: {
    key: "data_gathering",
    displayName: "Data gathering",
    defaultDurationMinutes: 45,
    deliveryModes: ["google_meet", "phone"],
    defaultAgendaPrompts: ["Outstanding information", "Document collection"],
    requiredDocumentCategories: ["financial", "identity"],
    followUpExpectation: "Confirm data completeness",
    checklistItems: BASE_CHECKLIST,
    active: true,
  },
  planning_presentation: {
    key: "planning_presentation",
    displayName: "Planning presentation",
    defaultDurationMinutes: 60,
    deliveryModes: ["google_meet", "physical"],
    defaultAgendaPrompts: ["Plan summary", "Recommendations overview", "Questions"],
    requiredDocumentCategories: ["planning"],
    followUpExpectation: "Capture follow-up actions",
    checklistItems: [
      ...BASE_CHECKLIST,
      {
        key: "confirm_planning_outputs",
        label: "Confirm planning outputs are ready",
        required: true,
        owner: "adviser",
        visibility: "adviser",
        sortOrder: 30,
      },
    ],
    active: true,
  },
  annual_review: {
    key: "annual_review",
    displayName: "Annual review",
    defaultDurationMinutes: 60,
    deliveryModes: ["google_meet", "physical", "phone"],
    defaultAgendaPrompts: ["Year in review", "Goal progress", "Plan adjustments"],
    requiredDocumentCategories: ["planning"],
    followUpExpectation: "Document review outcomes",
    checklistItems: BASE_CHECKLIST,
    active: true,
  },
  protection_review: {
    key: "protection_review",
    displayName: "Protection review",
    defaultDurationMinutes: 45,
    deliveryModes: ["google_meet", "physical", "phone"],
    defaultAgendaPrompts: ["Coverage summary", "Gap discussion"],
    requiredDocumentCategories: ["protection"],
    followUpExpectation: "Schedule verification if needed",
    checklistItems: BASE_CHECKLIST,
    active: true,
  },
  policy_servicing: {
    key: "policy_servicing",
    displayName: "Policy servicing",
    defaultDurationMinutes: 30,
    deliveryModes: ["phone", "google_meet"],
    defaultAgendaPrompts: ["Servicing request", "Required actions"],
    requiredDocumentCategories: [],
    followUpExpectation: "Confirm servicing completion",
    checklistItems: BASE_CHECKLIST,
    active: true,
  },
  general_check_in: {
    key: "general_check_in",
    displayName: "General check-in",
    defaultDurationMinutes: 30,
    deliveryModes: ["google_meet", "phone", "physical"],
    defaultAgendaPrompts: ["Wellbeing check", "Open questions"],
    requiredDocumentCategories: [],
    followUpExpectation: "Note any follow-up items",
    checklistItems: BASE_CHECKLIST,
    active: true,
  },
};

export const CRM_APPOINTMENT_TEMPLATE_KEYS = Object.keys(
  CRM_APPOINTMENT_TEMPLATES,
) as CrmAppointmentTemplateKey[];

export function getAppointmentTemplate(
  key: string,
): CrmAppointmentTemplate | null {
  if (key in CRM_APPOINTMENT_TEMPLATES) {
    return CRM_APPOINTMENT_TEMPLATES[key as CrmAppointmentTemplateKey];
  }
  return null;
}

export function isValidAppointmentTemplateKey(key: string): key is CrmAppointmentTemplateKey {
  return key in CRM_APPOINTMENT_TEMPLATES;
}
