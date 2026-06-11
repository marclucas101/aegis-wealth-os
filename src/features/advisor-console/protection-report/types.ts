export interface HouseholdInformation {
  householdName: string;
  primaryContact: string;
  statementPeriod: string;
  adviserName: string;
  adviserCompany: string;
}

export interface InsuredPerson {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  healthNotes: string;
}

export interface Policy {
  id: string;
  insuredPersonId: string;
  planName: string;
  insurer: string;
  policyType: string;
  policyNumber: string;
  sumAssured: number;
  sumAssuredLabel?: string;
  monthlyPremium?: number;
  annualPremium?: number;
  currentValue?: number;
  paidToDate?: number;
  whatItCovers: string;
  premiumTerm?: string;
  policyTerm?: string;
  policyStart?: string;
  beneficiary?: string;
  projectedValue?: string;
}

export interface InvestmentFund {
  id: string;
  policyId: string;
  fundName: string;
  allocationPercent: number;
  currentValue: number;
}

export interface ProtectionReportInput {
  household: HouseholdInformation;
  insuredPersons: InsuredPerson[];
  policies: Policy[];
  investmentFunds: InvestmentFund[];
}

export interface NumericCoverageResult {
  total: number;
  numericPolicyCount: number;
  nonNumericLabels: string[];
}

export interface ILPAllocationPolicyResult {
  policyId: string;
  totalPercent: number;
  isValid: boolean;
}

export interface ILPAllocationValidationResult {
  isValid: boolean;
  policyResults: ILPAllocationPolicyResult[];
}
