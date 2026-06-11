import {
  ILP_ALLOCATION_TOLERANCE,
  validateILPAllocations,
} from "./calculations";
import { sampleProtectionReport } from "./sampleProtectionReport";
import type {
  HouseholdInformation,
  InsuredPerson,
  InvestmentFund,
  Policy,
  ProtectionReportInput,
} from "./types";

export const PROTECTION_REPORT_STORAGE_KEY = "aegis-protection-report-draft-v1";

export const FORM_STEPS = [
  { id: "household", label: "Household Information" },
  { id: "people", label: "Insured Persons" },
  { id: "policies", label: "Policies" },
  { id: "funds", label: "ILP Fund Allocations" },
  { id: "review", label: "Review & Generate" },
] as const;

export type FormStepId = (typeof FORM_STEPS)[number]["id"];

export interface HouseholdDraft {
  householdName: string;
  primaryContact: string;
  statementPeriod: string;
  adviserName: string;
  adviserCompany: string;
}

export interface InsuredPersonDraft {
  id: string;
  fullName: string;
  relationship: string;
  age: string;
  healthNotes: string;
}

export interface PolicyDraft {
  id: string;
  insuredPersonId: string;
  planName: string;
  insurer: string;
  policyType: string;
  policyNumber: string;
  sumAssured: string;
  useNonNumericSumAssured: boolean;
  sumAssuredLabel: string;
  whatItCovers: string;
  monthlyPremium: string;
  currentValue: string;
  paidToDate: string;
  premiumTerm: string;
  policyTerm: string;
  policyStart: string;
  beneficiary: string;
  projectedValue: string;
}

export interface InvestmentFundDraft {
  id: string;
  policyId: string;
  fundName: string;
  allocationPercent: string;
  currentValue: string;
}

export interface ProtectionReportDraft {
  household: HouseholdDraft;
  insuredPersons: InsuredPersonDraft[];
  policies: PolicyDraft[];
  investmentFunds: InvestmentFundDraft[];
}

export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}

export function generateEntityId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isIlpPolicyType(policyType: string): boolean {
  return policyType.toUpperCase().includes("ILP");
}

export function parseOptionalNumber(
  value: string,
  label: string,
  fieldKey: string,
  fieldErrors: Record<string, string>,
  options?: { required?: boolean; min?: number }
): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    if (options?.required) {
      fieldErrors[fieldKey] = `${label} is required.`;
    }
    return undefined;
  }

  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    fieldErrors[fieldKey] = `${label} must be a valid number.`;
    return undefined;
  }

  if (options?.min !== undefined && parsed < options.min) {
    fieldErrors[fieldKey] = `${label} must be at least ${options.min}.`;
    return undefined;
  }

  return parsed;
}

export function createEmptyDraft(): ProtectionReportDraft {
  return {
    household: {
      householdName: "",
      primaryContact: "",
      statementPeriod: "",
      adviserName: "",
      adviserCompany: "",
    },
    insuredPersons: [
      {
        id: generateEntityId("person"),
        fullName: "",
        relationship: "",
        age: "",
        healthNotes: "",
      },
    ],
    policies: [
      {
        id: generateEntityId("policy"),
        insuredPersonId: "",
        planName: "",
        insurer: "",
        policyType: "",
        policyNumber: "",
        sumAssured: "",
        useNonNumericSumAssured: false,
        sumAssuredLabel: "As charged",
        whatItCovers: "",
        monthlyPremium: "",
        currentValue: "",
        paidToDate: "",
        premiumTerm: "",
        policyTerm: "",
        policyStart: "",
        beneficiary: "",
        projectedValue: "",
      },
    ],
    investmentFunds: [],
  };
}

export function draftFromSampleReport(): ProtectionReportDraft {
  const { household, insuredPersons, policies, investmentFunds } =
    sampleProtectionReport;

  return {
    household: { ...household },
    insuredPersons: insuredPersons.map((person) => ({
      id: person.id,
      fullName: person.fullName,
      relationship: person.relationship,
      age: String(person.age),
      healthNotes: person.healthNotes,
    })),
    policies: policies.map((policy) => ({
      id: policy.id,
      insuredPersonId: policy.insuredPersonId,
      planName: policy.planName,
      insurer: policy.insurer,
      policyType: policy.policyType,
      policyNumber: policy.policyNumber,
      sumAssured: policy.sumAssuredLabel ? "" : String(policy.sumAssured),
      useNonNumericSumAssured: Boolean(policy.sumAssuredLabel),
      sumAssuredLabel: policy.sumAssuredLabel ?? "As charged",
      whatItCovers: policy.whatItCovers,
      monthlyPremium:
        policy.monthlyPremium !== undefined ? String(policy.monthlyPremium) : "",
      currentValue:
        policy.currentValue !== undefined ? String(policy.currentValue) : "",
      paidToDate: policy.paidToDate !== undefined ? String(policy.paidToDate) : "",
      premiumTerm: policy.premiumTerm ?? "",
      policyTerm: policy.policyTerm ?? "",
      policyStart: policy.policyStart ?? "",
      beneficiary: policy.beneficiary ?? "",
      projectedValue: policy.projectedValue ?? "",
    })),
    investmentFunds: investmentFunds.map((fund) => ({
      id: fund.id,
      policyId: fund.policyId,
      fundName: fund.fundName,
      allocationPercent: String(fund.allocationPercent),
      currentValue: String(fund.currentValue),
    })),
  };
}

export function loadDraftFromStorage(): ProtectionReportDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PROTECTION_REPORT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as ProtectionReportDraft;
  } catch {
    return null;
  }
}

export function saveDraftToStorage(draft: ProtectionReportDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PROTECTION_REPORT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraftFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PROTECTION_REPORT_STORAGE_KEY);
}

export function getPersonDeleteBlockReason(
  draft: ProtectionReportDraft,
  personId: string
): string | null {
  const referencingPolicies = draft.policies.filter(
    (policy) => policy.insuredPersonId === personId
  );
  if (referencingPolicies.length > 0) {
    return `Cannot remove this person — ${referencingPolicies.length} polic${
      referencingPolicies.length === 1 ? "y" : "ies"
    } still reference them. Reassign or remove those policies first.`;
  }
  return null;
}

export function getPolicyDeleteBlockReason(
  draft: ProtectionReportDraft,
  policyId: string
): string | null {
  const referencingFunds = draft.investmentFunds.filter(
    (fund) => fund.policyId === policyId
  );
  if (referencingFunds.length > 0) {
    return `Cannot remove this policy — ${referencingFunds.length} investment fund${
      referencingFunds.length === 1 ? "" : "s"
    } still reference it. Remove those funds first.`;
  }
  return null;
}

export function getIlpPolicies(draft: ProtectionReportDraft): PolicyDraft[] {
  return draft.policies.filter((policy) => isIlpPolicyType(policy.policyType));
}

export function validateProtectionReportDraft(
  draft: ProtectionReportDraft
): FormValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const requiredHousehold: Array<keyof HouseholdDraft> = [
    "householdName",
    "primaryContact",
    "statementPeriod",
    "adviserName",
    "adviserCompany",
  ];

  for (const key of requiredHousehold) {
    if (!draft.household[key].trim()) {
      const message = "This field is required.";
      fieldErrors[`household.${key}`] = message;
      errors.push(`Household — ${key}: ${message}`);
    }
  }

  if (draft.insuredPersons.length === 0) {
    errors.push("At least one insured person is required.");
  }

  draft.insuredPersons.forEach((person, index) => {
    if (!person.fullName.trim()) {
      fieldErrors[`person.${person.id}.fullName`] = "Full name is required.";
      errors.push(`Insured person ${index + 1}: full name is required.`);
    }
    if (!person.relationship.trim()) {
      fieldErrors[`person.${person.id}.relationship`] = "Relationship is required.";
      errors.push(`Insured person ${index + 1}: relationship is required.`);
    }
    const age = parseOptionalNumber(
      person.age,
      "Age",
      `person.${person.id}.age`,
      fieldErrors,
      { required: true, min: 0 }
    );
    if (age !== undefined && age > 120) {
      fieldErrors[`person.${person.id}.age`] = "Age must be 120 or below.";
      errors.push(`Insured person ${index + 1}: age must be 120 or below.`);
    }
  });

  if (draft.policies.length === 0) {
    errors.push("At least one policy is required.");
  }

  const personIds = new Set(draft.insuredPersons.map((person) => person.id));

  draft.policies.forEach((policy, index) => {
    const prefix = `policy.${policy.id}`;

    if (!policy.insuredPersonId) {
      fieldErrors[`${prefix}.insuredPersonId`] = "Select an insured person.";
      errors.push(`Policy ${index + 1}: insured person is required.`);
    } else if (!personIds.has(policy.insuredPersonId)) {
      fieldErrors[`${prefix}.insuredPersonId`] = "Selected insured person no longer exists.";
      errors.push(`Policy ${index + 1}: invalid insured person reference.`);
    }

    if (!policy.planName.trim()) {
      fieldErrors[`${prefix}.planName`] = "Plan name is required.";
    }
    if (!policy.insurer.trim()) {
      fieldErrors[`${prefix}.insurer`] = "Insurer is required.";
    }
    if (!policy.policyType.trim()) {
      fieldErrors[`${prefix}.policyType`] = "Policy type is required.";
    }
    if (!policy.policyNumber.trim()) {
      fieldErrors[`${prefix}.policyNumber`] = "Policy number is required.";
    }
    if (!policy.whatItCovers.trim()) {
      fieldErrors[`${prefix}.whatItCovers`] = "Coverage description is required.";
    }

    if (policy.useNonNumericSumAssured) {
      if (!policy.sumAssuredLabel.trim()) {
        fieldErrors[`${prefix}.sumAssuredLabel`] = "Coverage label is required.";
      }
    } else {
      parseOptionalNumber(
        policy.sumAssured,
        "Sum assured",
        `${prefix}.sumAssured`,
        fieldErrors,
        { required: true, min: 0 }
      );
    }

    parseOptionalNumber(
      policy.monthlyPremium,
      "Monthly premium",
      `${prefix}.monthlyPremium`,
      fieldErrors
    );
    parseOptionalNumber(
      policy.currentValue,
      "Current value",
      `${prefix}.currentValue`,
      fieldErrors
    );
    parseOptionalNumber(
      policy.paidToDate,
      "Paid to date",
      `${prefix}.paidToDate`,
      fieldErrors
    );
  });

  const ilpPolicyIds = new Set(
    draft.policies
      .filter((policy) => isIlpPolicyType(policy.policyType))
      .map((policy) => policy.id)
  );

  draft.investmentFunds.forEach((fund, index) => {
    const prefix = `fund.${fund.id}`;

    if (!fund.policyId) {
      fieldErrors[`${prefix}.policyId`] = "Select an ILP policy.";
      errors.push(`Fund ${index + 1}: policy is required.`);
    } else if (!ilpPolicyIds.has(fund.policyId)) {
      fieldErrors[`${prefix}.policyId`] = "Funds must reference an ILP policy.";
      errors.push(`Fund ${index + 1}: must reference an ILP policy.`);
    }

    if (!fund.fundName.trim()) {
      fieldErrors[`${prefix}.fundName`] = "Fund name is required.";
    }

    parseOptionalNumber(
      fund.allocationPercent,
      "Allocation %",
      `${prefix}.allocationPercent`,
      fieldErrors,
      { required: true, min: 0 }
    );
    parseOptionalNumber(
      fund.currentValue,
      "Current value",
      `${prefix}.currentValue`,
      fieldErrors,
      { required: true, min: 0 }
    );
  });

  const ilpPoliciesWithFunds = [
    ...new Set(
      draft.investmentFunds
        .map((fund) => fund.policyId)
        .filter((policyId) => ilpPolicyIds.has(policyId))
    ),
  ];

  if (ilpPoliciesWithFunds.length > 0) {
    const parsedFunds: InvestmentFund[] = draft.investmentFunds
      .filter((fund) => ilpPolicyIds.has(fund.policyId))
      .map((fund) => ({
        id: fund.id,
        policyId: fund.policyId,
        fundName: fund.fundName,
        allocationPercent: Number(fund.allocationPercent) || 0,
        currentValue: Number(fund.currentValue) || 0,
      }));

    const allocationValidation = validateILPAllocations(
      parsedFunds,
      ilpPoliciesWithFunds
    );

    allocationValidation.policyResults.forEach((result) => {
      if (!result.isValid) {
        const policy = draft.policies.find((item) => item.id === result.policyId);
        const label = policy?.planName ?? result.policyId;
        const message = `ILP allocations for "${label}" total ${result.totalPercent.toFixed(1)}% (must be 100% ± ${ILP_ALLOCATION_TOLERANCE}).`;
        errors.push(message);
        fieldErrors[`ilp.${result.policyId}.allocation`] = message;
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

export function draftToReportInput(
  draft: ProtectionReportDraft
): { input: ProtectionReportInput | null; validation: FormValidationResult } {
  const validation = validateProtectionReportDraft(draft);
  if (!validation.isValid) {
    return { input: null, validation };
  }

  const household: HouseholdInformation = {
    householdName: draft.household.householdName.trim(),
    primaryContact: draft.household.primaryContact.trim(),
    statementPeriod: draft.household.statementPeriod.trim(),
    adviserName: draft.household.adviserName.trim(),
    adviserCompany: draft.household.adviserCompany.trim(),
  };

  const insuredPersons: InsuredPerson[] = draft.insuredPersons.map((person) => ({
    id: person.id,
    fullName: person.fullName.trim(),
    relationship: person.relationship.trim(),
    age: Number(person.age),
    healthNotes: person.healthNotes.trim(),
  }));

  const policies: Policy[] = draft.policies.map((policy) => {
    const monthlyPremium = parseOptionalNumber(
      policy.monthlyPremium,
      "Monthly premium",
      `policy.${policy.id}.monthlyPremium`,
      {}
    );

    const result: Policy = {
      id: policy.id,
      insuredPersonId: policy.insuredPersonId,
      planName: policy.planName.trim(),
      insurer: policy.insurer.trim(),
      policyType: policy.policyType.trim(),
      policyNumber: policy.policyNumber.trim(),
      sumAssured: policy.useNonNumericSumAssured
        ? 0
        : Number(policy.sumAssured.replace(/,/g, "")),
      whatItCovers: policy.whatItCovers.trim(),
    };

    if (policy.useNonNumericSumAssured) {
      result.sumAssuredLabel = policy.sumAssuredLabel.trim();
    }

    if (monthlyPremium !== undefined) {
      result.monthlyPremium = monthlyPremium;
      result.annualPremium = monthlyPremium * 12;
    }

    const currentValue = parseOptionalNumber(
      policy.currentValue,
      "Current value",
      `policy.${policy.id}.currentValue`,
      {}
    );
    if (currentValue !== undefined) {
      result.currentValue = currentValue;
    }

    const paidToDate = parseOptionalNumber(
      policy.paidToDate,
      "Paid to date",
      `policy.${policy.id}.paidToDate`,
      {}
    );
    if (paidToDate !== undefined) {
      result.paidToDate = paidToDate;
    }

    if (policy.premiumTerm.trim()) result.premiumTerm = policy.premiumTerm.trim();
    if (policy.policyTerm.trim()) result.policyTerm = policy.policyTerm.trim();
    if (policy.policyStart.trim()) result.policyStart = policy.policyStart.trim();
    if (policy.beneficiary.trim()) result.beneficiary = policy.beneficiary.trim();
    if (policy.projectedValue.trim()) {
      result.projectedValue = policy.projectedValue.trim();
    }

    return result;
  });

  const investmentFunds: InvestmentFund[] = draft.investmentFunds.map((fund) => ({
    id: fund.id,
    policyId: fund.policyId,
    fundName: fund.fundName.trim(),
    allocationPercent: Number(fund.allocationPercent),
    currentValue: Number(fund.currentValue),
  }));

  return {
    input: { household, insuredPersons, policies, investmentFunds },
    validation,
  };
}
