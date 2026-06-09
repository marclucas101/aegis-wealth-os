"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateDiscoverScore } from "@/src/lib/scoring";
import type { DiscoverCompleteness } from "@/src/lib/scoring/types";
import {
  computeCompleteness,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  saveDiscoverProfile,
  type DiscoverFormData,
} from "@/lib/aegis/localProfile";
import DiscoverProgress, { type DiscoverStep } from "./DiscoverProgress";
import DiscoverStepCard from "./DiscoverStepCard";
import DiscoverSummary, { type SectionSummary } from "./DiscoverSummary";
import {
  FieldGrid,
  FieldStack,
  FinancialCheckbox,
  FinancialSelect,
  FinancialTextInput,
} from "./FinancialInput";

export type { DiscoverFormData };

const DEFAULT_FORM_DATA: DiscoverFormData = {
  personal: {
    firstName: "Marcus",
    lastName: "Tan",
    dateOfBirth: "1982-06-15",
    nationality: "singaporean",
    maritalStatus: "married",
    occupation: "Managing Director",
    residency: "singapore_pr",
  },
  family: {
    hasPartner: true,
    partnerName: "Sarah Tan",
    numberOfChildren: "2",
    dependantDetails: "Two school-age children",
    caregivingResponsibilities: "Aging parents — moderate support",
  },
  income: {
    primaryIncome: "260000",
    secondaryIncome: "52000",
    incomeType: "employment",
    employer: "Tan Holdings Pte Ltd",
    bonusIncome: "48000",
  },
  expenses: {
    monthlyEssential: "12000",
    monthlyDiscretionary: "4500",
    monthlyHousing: "3800",
    monthlyInsurance: "1500",
    monthlyOther: "2200",
  },
  assets: {
    cashAssets: "180000",
    cpfBalance: "420000",
    propertyValue: "1850000",
    investmentProperty: "0",
    otherAssets: "95000",
  },
  liabilities: {
    mortgageBalance: "680000",
    personalLoans: "45000",
    creditCardDebt: "8000",
    otherLiabilities: "12000",
    totalDebt: "745000",
  },
  policies: {
    lifeInsurance: "900000",
    healthInsurance: "isp_with_rider",
    ciCoverage: "600000",
    disabilityCoverage: "12000",
    hasPolicyReview: true,
  },
  investments: {
    investmentAccounts: "3",
    totalInvestments: "850000",
    assetAllocation: "balanced",
    riskProfile: "moderate",
    monthlyContribution: "4500",
  },
  retirement: {
    targetRetirementAge: "62",
    desiredRetirementIncome: "18000",
    currentRetirementSavings: "1200000",
    retirementPriority: "maintain_lifestyle",
    cpfLifePlan: "standard",
  },
  estate: {
    hasWill: true,
    hasCpfNomination: true,
    hasTrust: false,
    beneficiaryDocumented: true,
    estatePlanReviewed: false,
  },
  business: {
    isBusinessOwner: true,
    businessName: "Tan Holdings Pte Ltd",
    successionPlan: "informal",
    familyGovernance: "basic",
    familyMeetings: "annual",
  },
};

const STEPS: DiscoverStep[] = [
  { id: "personal", title: "Personal Profile", shortLabel: "Personal" },
  { id: "family", title: "Family Profile", shortLabel: "Family" },
  { id: "income", title: "Income", shortLabel: "Income" },
  { id: "expenses", title: "Expenses", shortLabel: "Expenses" },
  { id: "assets", title: "Assets", shortLabel: "Assets" },
  { id: "liabilities", title: "Liabilities", shortLabel: "Debt" },
  { id: "policies", title: "Policies", shortLabel: "Policies" },
  { id: "investments", title: "Investments", shortLabel: "Invest" },
  { id: "retirement", title: "Retirement Goals", shortLabel: "Retire" },
  { id: "estate", title: "Estate Planning", shortLabel: "Estate" },
  { id: "business", title: "Business & Governance", shortLabel: "Business" },
];

const SECTION_META: Array<{
  key: keyof DiscoverCompleteness;
  title: string;
}> = [
  { key: "personalInfo", title: "Personal Profile" },
  { key: "familyInfo", title: "Family Profile" },
  { key: "income", title: "Income" },
  { key: "expenses", title: "Expenses" },
  { key: "assets", title: "Assets" },
  { key: "liabilities", title: "Liabilities" },
  { key: "policies", title: "Policies" },
  { key: "investments", title: "Investments" },
  { key: "retirementGoals", title: "Retirement Goals" },
  { key: "estate", title: "Estate Planning" },
  { key: "businessGovernance", title: "Business & Governance" },
];

export default function DiscoverWizard() {
  const [formData, setFormData] = useState<DiscoverFormData>(DEFAULT_FORM_DATA);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const remoteSaveAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProfile() {
      try {
        const response = await fetch("/api/discover/current");
        if (response.ok) {
          const data = (await response.json()) as {
            ok?: boolean;
            profile?: { formData: DiscoverFormData };
          };
          if (!cancelled && data.ok && data.profile?.formData) {
            setFormData(data.profile.formData);
            setHydrated(true);
            return;
          }
        }
      } catch {
        // Fall back to localStorage below.
      }

      const local = loadDiscoverProfile();
      if (!cancelled && local?.formData) {
        setFormData(local.formData);
      }
      if (!cancelled) {
        setHydrated(true);
      }
    }

    void hydrateProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const completeness = useMemo(
    () => computeCompleteness(formData),
    [formData]
  );

  const scoreResult = useMemo(
    () => calculateDiscoverScore(completeness),
    [completeness]
  );

  useEffect(() => {
    if (!showSummary || !hydrated) return;

    saveDiscoverProfile({
      formData,
      completeness,
      discoverScore: scoreResult.discoverScore,
      dataConfidenceFactor: scoreResult.dataConfidenceFactor,
    });
  }, [showSummary, hydrated, formData, completeness, scoreResult]);

  useEffect(() => {
    if (!showSummary || !hydrated || remoteSaveAttempted.current) return;

    remoteSaveAttempted.current = true;
    let cancelled = false;

    async function saveRemote() {
      setIsSavingRemote(true);
      setSaveWarning(null);

      try {
        const response = await fetch("/api/discover/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formData,
            completeness,
            discoverScore: scoreResult.discoverScore,
            dataConfidenceFactor: scoreResult.dataConfidenceFactor,
            roadmapStatuses: loadRoadmapStatuses(),
          }),
        });

        const data = (await response.json()) as { ok?: boolean; error?: string };

        if (cancelled) return;

        if (!response.ok || !data.ok) {
          setSaveWarning(
            data.error ??
              "Cloud save unavailable — your profile is saved locally on this device.",
          );
        }
      } catch {
        if (!cancelled) {
          setSaveWarning(
            "Cloud save unavailable — your profile is saved locally on this device.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsSavingRemote(false);
        }
      }
    }

    void saveRemote();

    return () => {
      cancelled = true;
    };
  }, [showSummary, hydrated, formData, completeness, scoreResult]);

  const sectionCompleteness = useMemo(
    () => SECTION_META.map((section) => completeness[section.key]),
    [completeness]
  );

  const sectionSummaries: SectionSummary[] = useMemo(
    () =>
      SECTION_META.map((section) => ({
        id: section.key,
        title: section.title,
        completeness: completeness[section.key],
      })),
    [completeness]
  );

  const updatePersonal = <K extends keyof DiscoverFormData["personal"]>(
    key: K,
    value: DiscoverFormData["personal"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      personal: { ...prev.personal, [key]: value },
    }));
  };

  const updateFamily = <K extends keyof DiscoverFormData["family"]>(
    key: K,
    value: DiscoverFormData["family"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      family: { ...prev.family, [key]: value },
    }));
  };

  const updateIncome = <K extends keyof DiscoverFormData["income"]>(
    key: K,
    value: DiscoverFormData["income"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      income: { ...prev.income, [key]: value },
    }));
  };

  const updateExpenses = <K extends keyof DiscoverFormData["expenses"]>(
    key: K,
    value: DiscoverFormData["expenses"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      expenses: { ...prev.expenses, [key]: value },
    }));
  };

  const updateAssets = <K extends keyof DiscoverFormData["assets"]>(
    key: K,
    value: DiscoverFormData["assets"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      assets: { ...prev.assets, [key]: value },
    }));
  };

  const updateLiabilities = <K extends keyof DiscoverFormData["liabilities"]>(
    key: K,
    value: DiscoverFormData["liabilities"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      liabilities: { ...prev.liabilities, [key]: value },
    }));
  };

  const updatePolicies = <K extends keyof DiscoverFormData["policies"]>(
    key: K,
    value: DiscoverFormData["policies"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      policies: { ...prev.policies, [key]: value },
    }));
  };

  const updateInvestments = <K extends keyof DiscoverFormData["investments"]>(
    key: K,
    value: DiscoverFormData["investments"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      investments: { ...prev.investments, [key]: value },
    }));
  };

  const updateRetirement = <K extends keyof DiscoverFormData["retirement"]>(
    key: K,
    value: DiscoverFormData["retirement"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      retirement: { ...prev.retirement, [key]: value },
    }));
  };

  const updateEstate = <K extends keyof DiscoverFormData["estate"]>(
    key: K,
    value: DiscoverFormData["estate"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      estate: { ...prev.estate, [key]: value },
    }));
  };

  const updateBusiness = <K extends keyof DiscoverFormData["business"]>(
    key: K,
    value: DiscoverFormData["business"][K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      business: { ...prev.business, [key]: value },
    }));
  };

  const handleBack = () => {
    if (showSummary) {
      setShowSummary(false);
      setCurrentStep(STEPS.length - 1);
      return;
    }
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const handleContinue = () => {
    if (currentStep >= STEPS.length - 1) {
      setShowSummary(true);
      return;
    }
    setCurrentStep((step) => step + 1);
  };

  const currentCompleteness = sectionCompleteness[currentStep] ?? 0;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="firstName"
              label="First Name"
              value={formData.personal.firstName}
              onChange={(value) => updatePersonal("firstName", value)}
            />
            <FinancialTextInput
              id="lastName"
              label="Last Name"
              value={formData.personal.lastName}
              onChange={(value) => updatePersonal("lastName", value)}
            />
            <FinancialTextInput
              id="dateOfBirth"
              label="Date of Birth"
              type="text"
              value={formData.personal.dateOfBirth}
              onChange={(value) => updatePersonal("dateOfBirth", value)}
              placeholder="YYYY-MM-DD"
            />
            <FinancialSelect
              id="nationality"
              label="Nationality"
              value={formData.personal.nationality}
              onChange={(value) => updatePersonal("nationality", value)}
              options={[
                { value: "singaporean", label: "Singapore Citizen" },
                { value: "pr", label: "Permanent Resident" },
                { value: "foreigner", label: "Foreign National" },
              ]}
            />
            <FinancialSelect
              id="maritalStatus"
              label="Marital Status"
              value={formData.personal.maritalStatus}
              onChange={(value) => updatePersonal("maritalStatus", value)}
              options={[
                { value: "single", label: "Single" },
                { value: "married", label: "Married" },
                { value: "partnered", label: "Partnered" },
                { value: "divorced", label: "Divorced" },
                { value: "widowed", label: "Widowed" },
              ]}
            />
            <FinancialTextInput
              id="occupation"
              label="Occupation"
              value={formData.personal.occupation}
              onChange={(value) => updatePersonal("occupation", value)}
            />
            <FinancialSelect
              id="residency"
              label="Residency Status"
              value={formData.personal.residency}
              onChange={(value) => updatePersonal("residency", value)}
              options={[
                { value: "singapore_pr", label: "Singapore Resident" },
                { value: "regional", label: "Regional Resident" },
                { value: "global", label: "Global / Multi-jurisdiction" },
              ]}
            />
          </FieldGrid>
        );
      case 1:
        return (
          <FieldStack>
            <FinancialCheckbox
              id="hasPartner"
              label="Has spouse or partner"
              checked={formData.family.hasPartner}
              onChange={(value) => updateFamily("hasPartner", value)}
            />
            {formData.family.hasPartner && (
              <FinancialTextInput
                id="partnerName"
                label="Partner Name"
                value={formData.family.partnerName}
                onChange={(value) => updateFamily("partnerName", value)}
              />
            )}
            <FieldGrid>
              <FinancialTextInput
                id="numberOfChildren"
                label="Number of Children"
                type="number"
                value={formData.family.numberOfChildren}
                onChange={(value) => updateFamily("numberOfChildren", value)}
                min={0}
              />
              <FinancialTextInput
                id="dependantDetails"
                label="Dependant Details"
                value={formData.family.dependantDetails}
                onChange={(value) => updateFamily("dependantDetails", value)}
                hint="Children, elderly parents, or other dependants"
              />
            </FieldGrid>
            <FinancialTextInput
              id="caregiving"
              label="Caregiving Responsibilities"
              value={formData.family.caregivingResponsibilities}
              onChange={(value) =>
                updateFamily("caregivingResponsibilities", value)
              }
            />
          </FieldStack>
        );
      case 2:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="primaryIncome"
              label="Primary Annual Income"
              type="number"
              prefix="S$"
              value={formData.income.primaryIncome}
              onChange={(value) => updateIncome("primaryIncome", value)}
            />
            <FinancialTextInput
              id="secondaryIncome"
              label="Secondary Income"
              type="number"
              prefix="S$"
              value={formData.income.secondaryIncome}
              onChange={(value) => updateIncome("secondaryIncome", value)}
            />
            <FinancialSelect
              id="incomeType"
              label="Primary Income Type"
              value={formData.income.incomeType}
              onChange={(value) => updateIncome("incomeType", value)}
              options={[
                { value: "employment", label: "Employment" },
                { value: "business", label: "Business / Self-employed" },
                { value: "investment", label: "Investment Income" },
                { value: "mixed", label: "Mixed Sources" },
              ]}
            />
            <FinancialTextInput
              id="employer"
              label="Employer / Business Entity"
              value={formData.income.employer}
              onChange={(value) => updateIncome("employer", value)}
            />
            <FinancialTextInput
              id="bonusIncome"
              label="Annual Bonus / Variable"
              type="number"
              prefix="S$"
              value={formData.income.bonusIncome}
              onChange={(value) => updateIncome("bonusIncome", value)}
            />
          </FieldGrid>
        );
      case 3:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="monthlyEssential"
              label="Monthly Essential Expenses"
              type="number"
              prefix="S$"
              value={formData.expenses.monthlyEssential}
              onChange={(value) => updateExpenses("monthlyEssential", value)}
            />
            <FinancialTextInput
              id="monthlyDiscretionary"
              label="Monthly Discretionary"
              type="number"
              prefix="S$"
              value={formData.expenses.monthlyDiscretionary}
              onChange={(value) => updateExpenses("monthlyDiscretionary", value)}
            />
            <FinancialTextInput
              id="monthlyHousing"
              label="Housing Costs"
              type="number"
              prefix="S$"
              value={formData.expenses.monthlyHousing}
              onChange={(value) => updateExpenses("monthlyHousing", value)}
            />
            <FinancialTextInput
              id="monthlyInsurance"
              label="Insurance Premiums"
              type="number"
              prefix="S$"
              value={formData.expenses.monthlyInsurance}
              onChange={(value) => updateExpenses("monthlyInsurance", value)}
            />
            <FinancialTextInput
              id="monthlyOther"
              label="Other Fixed Expenses"
              type="number"
              prefix="S$"
              value={formData.expenses.monthlyOther}
              onChange={(value) => updateExpenses("monthlyOther", value)}
            />
          </FieldGrid>
        );
      case 4:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="cashAssets"
              label="Cash & Liquid Assets"
              type="number"
              prefix="S$"
              value={formData.assets.cashAssets}
              onChange={(value) => updateAssets("cashAssets", value)}
            />
            <FinancialTextInput
              id="cpfBalance"
              label="CPF Balance"
              type="number"
              prefix="S$"
              value={formData.assets.cpfBalance}
              onChange={(value) => updateAssets("cpfBalance", value)}
            />
            <FinancialTextInput
              id="propertyValue"
              label="Primary Property Value"
              type="number"
              prefix="S$"
              value={formData.assets.propertyValue}
              onChange={(value) => updateAssets("propertyValue", value)}
            />
            <FinancialTextInput
              id="investmentProperty"
              label="Investment Property"
              type="number"
              prefix="S$"
              value={formData.assets.investmentProperty}
              onChange={(value) => updateAssets("investmentProperty", value)}
            />
            <FinancialTextInput
              id="otherAssets"
              label="Other Assets"
              type="number"
              prefix="S$"
              value={formData.assets.otherAssets}
              onChange={(value) => updateAssets("otherAssets", value)}
            />
          </FieldGrid>
        );
      case 5:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="mortgageBalance"
              label="Mortgage Balance"
              type="number"
              prefix="S$"
              value={formData.liabilities.mortgageBalance}
              onChange={(value) => updateLiabilities("mortgageBalance", value)}
            />
            <FinancialTextInput
              id="personalLoans"
              label="Personal Loans"
              type="number"
              prefix="S$"
              value={formData.liabilities.personalLoans}
              onChange={(value) => updateLiabilities("personalLoans", value)}
            />
            <FinancialTextInput
              id="creditCardDebt"
              label="Credit Card Debt"
              type="number"
              prefix="S$"
              value={formData.liabilities.creditCardDebt}
              onChange={(value) => updateLiabilities("creditCardDebt", value)}
            />
            <FinancialTextInput
              id="otherLiabilities"
              label="Other Liabilities"
              type="number"
              prefix="S$"
              value={formData.liabilities.otherLiabilities}
              onChange={(value) => updateLiabilities("otherLiabilities", value)}
            />
            <FinancialTextInput
              id="totalDebt"
              label="Total Debt"
              type="number"
              prefix="S$"
              value={formData.liabilities.totalDebt}
              onChange={(value) => updateLiabilities("totalDebt", value)}
              hint="Consolidated outstanding obligations"
            />
          </FieldGrid>
        );
      case 6:
        return (
          <FieldStack>
            <FieldGrid>
              <FinancialTextInput
                id="lifeInsurance"
                label="Life Insurance Coverage"
                type="number"
                prefix="S$"
                value={formData.policies.lifeInsurance}
                onChange={(value) => updatePolicies("lifeInsurance", value)}
              />
              <FinancialSelect
                id="healthInsurance"
                label="Hospitalisation Coverage"
                value={formData.policies.healthInsurance}
                onChange={(value) => updatePolicies("healthInsurance", value)}
                options={[
                  { value: "none", label: "None" },
                  { value: "basic_public", label: "Basic / Public" },
                  { value: "isp_without_rider", label: "ISP without Rider" },
                  { value: "isp_with_rider", label: "ISP with Rider" },
                  { value: "comprehensive", label: "Comprehensive" },
                ]}
              />
              <FinancialTextInput
                id="ciCoverage"
                label="Critical Illness Coverage"
                type="number"
                prefix="S$"
                value={formData.policies.ciCoverage}
                onChange={(value) => updatePolicies("ciCoverage", value)}
              />
              <FinancialTextInput
                id="disabilityCoverage"
                label="Disability Income (Monthly)"
                type="number"
                prefix="S$"
                value={formData.policies.disabilityCoverage}
                onChange={(value) => updatePolicies("disabilityCoverage", value)}
              />
            </FieldGrid>
            <FinancialCheckbox
              id="hasPolicyReview"
              label="Policies reviewed within 24 months"
              checked={formData.policies.hasPolicyReview}
              onChange={(value) => updatePolicies("hasPolicyReview", value)}
              description="Recent review improves data confidence for protection analysis"
            />
          </FieldStack>
        );
      case 7:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="investmentAccounts"
              label="Investment Accounts"
              type="number"
              value={formData.investments.investmentAccounts}
              onChange={(value) => updateInvestments("investmentAccounts", value)}
            />
            <FinancialTextInput
              id="totalInvestments"
              label="Total Investable Assets"
              type="number"
              prefix="S$"
              value={formData.investments.totalInvestments}
              onChange={(value) => updateInvestments("totalInvestments", value)}
            />
            <FinancialSelect
              id="assetAllocation"
              label="Asset Allocation Approach"
              value={formData.investments.assetAllocation}
              onChange={(value) => updateInvestments("assetAllocation", value)}
              options={[
                { value: "cash_heavy", label: "Cash Concentrated" },
                { value: "conservative", label: "Conservative" },
                { value: "balanced", label: "Balanced Multi-Asset" },
                { value: "growth", label: "Growth Oriented" },
                { value: "strategic", label: "Goals-Based Strategic" },
              ]}
            />
            <FinancialSelect
              id="riskProfile"
              label="Risk Profile"
              value={formData.investments.riskProfile}
              onChange={(value) => updateInvestments("riskProfile", value)}
              options={[
                { value: "conservative", label: "Conservative" },
                { value: "moderate", label: "Moderate" },
                { value: "balanced", label: "Balanced" },
                { value: "aggressive", label: "Aggressive" },
              ]}
            />
            <FinancialTextInput
              id="monthlyContribution"
              label="Monthly Investment Contribution"
              type="number"
              prefix="S$"
              value={formData.investments.monthlyContribution}
              onChange={(value) => updateInvestments("monthlyContribution", value)}
            />
          </FieldGrid>
        );
      case 8:
        return (
          <FieldGrid>
            <FinancialTextInput
              id="targetRetirementAge"
              label="Target Retirement Age"
              type="number"
              value={formData.retirement.targetRetirementAge}
              onChange={(value) => updateRetirement("targetRetirementAge", value)}
            />
            <FinancialTextInput
              id="desiredRetirementIncome"
              label="Desired Monthly Retirement Income"
              type="number"
              prefix="S$"
              value={formData.retirement.desiredRetirementIncome}
              onChange={(value) =>
                updateRetirement("desiredRetirementIncome", value)
              }
            />
            <FinancialTextInput
              id="currentRetirementSavings"
              label="Current Retirement Savings"
              type="number"
              prefix="S$"
              value={formData.retirement.currentRetirementSavings}
              onChange={(value) =>
                updateRetirement("currentRetirementSavings", value)
              }
            />
            <FinancialSelect
              id="retirementPriority"
              label="Retirement Priority"
              value={formData.retirement.retirementPriority}
              onChange={(value) => updateRetirement("retirementPriority", value)}
              options={[
                { value: "maintain_lifestyle", label: "Maintain Current Lifestyle" },
                { value: "enhance", label: "Enhance Lifestyle" },
                { value: "essential_only", label: "Essential Needs Only" },
                { value: "legacy_focus", label: "Legacy-Focused" },
              ]}
            />
            <FinancialSelect
              id="cpfLifePlan"
              label="CPF LIFE Plan"
              value={formData.retirement.cpfLifePlan}
              onChange={(value) => updateRetirement("cpfLifePlan", value)}
              options={[
                { value: "standard", label: "Standard Plan" },
                { value: "basic", label: "Basic Plan" },
                { value: "escalating", label: "Escalating Plan" },
                { value: "undecided", label: "Undecided" },
              ]}
            />
          </FieldGrid>
        );
      case 9:
        return (
          <FieldStack>
            <FinancialCheckbox
              id="hasWill"
              label="Valid will in place"
              checked={formData.estate.hasWill}
              onChange={(value) => updateEstate("hasWill", value)}
            />
            <FinancialCheckbox
              id="hasCpfNomination"
              label="CPF nomination completed"
              checked={formData.estate.hasCpfNomination}
              onChange={(value) => updateEstate("hasCpfNomination", value)}
            />
            <FinancialCheckbox
              id="hasTrust"
              label="Trust structure established"
              checked={formData.estate.hasTrust}
              onChange={(value) => updateEstate("hasTrust", value)}
            />
            <FinancialCheckbox
              id="beneficiaryDocumented"
              label="Beneficiaries clearly documented"
              checked={formData.estate.beneficiaryDocumented}
              onChange={(value) => updateEstate("beneficiaryDocumented", value)}
            />
            <FinancialCheckbox
              id="estatePlanReviewed"
              label="Estate plan reviewed within 3 years"
              checked={formData.estate.estatePlanReviewed}
              onChange={(value) => updateEstate("estatePlanReviewed", value)}
            />
          </FieldStack>
        );
      case 10:
        return (
          <FieldStack>
            <FinancialCheckbox
              id="isBusinessOwner"
              label="Business owner or principal"
              checked={formData.business.isBusinessOwner}
              onChange={(value) => updateBusiness("isBusinessOwner", value)}
            />
            {formData.business.isBusinessOwner && (
              <FinancialTextInput
                id="businessName"
                label="Business Entity Name"
                value={formData.business.businessName}
                onChange={(value) => updateBusiness("businessName", value)}
              />
            )}
            <FieldGrid>
              <FinancialSelect
                id="successionPlan"
                label="Succession Planning Status"
                value={formData.business.successionPlan}
                onChange={(value) => updateBusiness("successionPlan", value)}
                options={[
                  { value: "none", label: "None" },
                  { value: "informal", label: "Informal Arrangement" },
                  { value: "key_person", label: "Key Person Coverage" },
                  { value: "formal", label: "Formal Buy-Sell / Succession" },
                ]}
              />
              <FinancialSelect
                id="familyGovernance"
                label="Family Governance Maturity"
                value={formData.business.familyGovernance}
                onChange={(value) => updateBusiness("familyGovernance", value)}
                options={[
                  { value: "none", label: "None" },
                  { value: "basic", label: "Basic Discussions" },
                  { value: "structured", label: "Structured Framework" },
                  { value: "formal", label: "Formal Constitution" },
                ]}
              />
              <FinancialSelect
                id="familyMeetings"
                label="Family Meeting Cadence"
                value={formData.business.familyMeetings}
                onChange={(value) => updateBusiness("familyMeetings", value)}
                options={[
                  { value: "none", label: "None" },
                  { value: "ad_hoc", label: "Ad Hoc" },
                  { value: "annual", label: "Annual" },
                  { value: "quarterly", label: "Quarterly" },
                ]}
              />
            </FieldGrid>
          </FieldStack>
        );
      default:
        return null;
    }
  };

  const stepSubtitles: Record<number, string> = {
    0: "Establish identity, residency, and professional context for wealth architecture.",
    1: "Map dependants, partner relationships, and caregiving obligations.",
    2: "Capture primary and secondary income streams for survivability analysis.",
    3: "Document essential and discretionary outflows to establish baseline exposure.",
    4: "Register liquid, retirement, and property assets across the balance sheet.",
    5: "Quantify outstanding debt obligations and leverage exposure.",
    6: "Record protection policies that form the defensive layer of the shield.",
    7: "Profile investable assets, allocation discipline, and contribution behaviour.",
    8: "Define retirement targets and projected income requirements.",
    9: "Assess estate documentation and wealth transfer readiness.",
    10: "Capture business continuity and family governance structures.",
  };

  if (showSummary) {
    return (
      <DiscoverSummary
        result={scoreResult}
        sections={sectionSummaries}
        onBack={() => {
          remoteSaveAttempted.current = false;
          setShowSummary(false);
        }}
        saveWarning={saveWarning}
        isSavingRemote={isSavingRemote}
      />
    );
  }

  return (
    <div>
      <DiscoverProgress
        steps={STEPS}
        currentStep={currentStep}
        sectionCompleteness={sectionCompleteness}
      />

      <DiscoverStepCard
        stepNumber={currentStep + 1}
        totalSteps={STEPS.length}
        title={STEPS[currentStep]?.title ?? ""}
        subtitle={stepSubtitles[currentStep] ?? ""}
        completeness={currentCompleteness}
      >
        {renderStepContent()}
      </DiscoverStepCard>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/25 sm:text-left">
          Discover Score™ · {Math.round(scoreResult.discoverScore)} · Confidence{" "}
          {scoreResult.dataConfidenceFactor.toFixed(3)}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="rounded-sm border border-[#D1A866]/20 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/60 transition-colors hover:border-[#D1A866]/35 hover:text-[#F3F1EA] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            {currentStep >= STEPS.length - 1 ? "View Summary" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
