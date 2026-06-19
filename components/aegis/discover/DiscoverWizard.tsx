"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateDiscoverScore } from "@/src/lib/scoring";
import type { DiscoverCompleteness } from "@/src/lib/scoring/types";
import {
  clearDiscoverProfile,
  computeCompleteness,
  loadDiscoverDraftResumeStep,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  saveDiscoverProfile,
  type DiscoverFormData,
} from "@/lib/aegis/localProfile";
import DiscoverProgress, { type DiscoverStep } from "./DiscoverProgress";
import DiscoverStepCard from "./DiscoverStepCard";
import DiscoverSummary, { type SectionSummary } from "./DiscoverSummary";
import ProspectSectionProgress from "@/components/aegis/prospect/ProspectSectionProgress";
import {
  DISCOVER_WIZARD_STEPS,
  PROSPECT_PROFILE_SECTIONS,
} from "@/lib/aegis/prospectProfileSections";
import {
  FieldGrid,
  FieldStack,
  FinancialCheckbox,
  FinancialSelect,
  FinancialTextInput,
} from "./FinancialInput";

export type { DiscoverFormData };

const EMPTY_FORM_DATA: DiscoverFormData = {
  personal: {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    nationality: "",
    maritalStatus: "",
    occupation: "",
    residency: "",
  },
  family: {
    hasPartner: false,
    partnerName: "",
    numberOfChildren: "",
    dependantDetails: "",
    caregivingResponsibilities: "",
  },
  income: {
    primaryIncome: "",
    secondaryIncome: "",
    incomeType: "",
    employer: "",
    bonusIncome: "",
  },
  expenses: {
    monthlyEssential: "",
    monthlyDiscretionary: "",
    monthlyHousing: "",
    monthlyInsurance: "",
    monthlyOther: "",
  },
  assets: {
    cashAssets: "",
    cpfBalance: "",
    propertyValue: "",
    investmentProperty: "",
    otherAssets: "",
  },
  liabilities: {
    mortgageBalance: "",
    personalLoans: "",
    creditCardDebt: "",
    otherLiabilities: "",
    totalDebt: "",
  },
  policies: {
    lifeInsurance: "",
    healthInsurance: "",
    ciCoverage: "",
    disabilityCoverage: "",
    hasPolicyReview: false,
  },
  investments: {
    investmentAccounts: "",
    totalInvestments: "",
    assetAllocation: "",
    riskProfile: "",
    monthlyContribution: "",
  },
  retirement: {
    targetRetirementAge: "",
    desiredRetirementIncome: "",
    currentRetirementSavings: "",
    retirementPriority: "",
    cpfLifePlan: "",
  },
  estate: {
    hasWill: false,
    hasCpfNomination: false,
    hasTrust: false,
    beneficiaryDocumented: false,
    estatePlanReviewed: false,
  },
  business: {
    isBusinessOwner: false,
    businessName: "",
    successionPlan: "",
    familyGovernance: "",
    familyMeetings: "",
  },
};

const STEPS: DiscoverStep[] = DISCOVER_WIZARD_STEPS;

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
  const [formData, setFormData] = useState<DiscoverFormData>(EMPTY_FORM_DATA);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [isSavingRemote, setIsSavingRemote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const remoteSaveAttempted = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProfile() {
      let resolvedUserId: string | null = null;
      try {
        const meResponse = await fetch("/api/me", { cache: "no-store" });
        const meData = (await meResponse.json()) as {
          authenticated?: boolean;
          userId?: string;
        };
        resolvedUserId =
          meData.authenticated && meData.userId ? meData.userId : null;
        if (!cancelled && resolvedUserId) {
          setUserId(resolvedUserId);
        }

        const response = await fetch("/api/discover/current");
        if (response.ok) {
          const data = (await response.json()) as {
            ok?: boolean;
            profile?: { formData: DiscoverFormData };
          };
          if (!cancelled && data.ok && data.profile?.formData) {
            setFormData(data.profile.formData);
            const resumeStep = loadDiscoverDraftResumeStep(resolvedUserId);
            if (resumeStep != null && resumeStep >= 0 && resumeStep < STEPS.length) {
              setCurrentStep(resumeStep);
            }
            setHydrated(true);
            return;
          }
        }
      } catch {
        // Fall back to localStorage below.
      }

      const local = loadDiscoverProfile(resolvedUserId);
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

  const saveRemoteProfile = useCallback(async () => {
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
          roadmapStatuses: loadRoadmapStatuses(userId),
        }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setSaveWarning(
          data.error ??
            "Cloud save unavailable — your profile is saved locally on this device.",
        );
        return false;
      }

      return true;
    } catch {
      setSaveWarning(
        "Cloud save unavailable — your profile is saved locally on this device.",
      );
      return false;
    } finally {
      setIsSavingRemote(false);
    }
  }, [formData, completeness, scoreResult, userId]);

  useEffect(() => {
    if (!hydrated) return;

    saveDiscoverProfile(
      {
        formData,
        completeness,
        discoverScore: scoreResult.discoverScore,
        dataConfidenceFactor: scoreResult.dataConfidenceFactor,
      },
      { userId, currentStep },
    );

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      void saveRemoteProfile();
    }, 2000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [hydrated, formData, completeness, scoreResult, saveRemoteProfile, userId, currentStep]);

  useEffect(() => {
    if (!showSummary || !hydrated) return;

    saveDiscoverProfile(
      {
        formData,
        completeness,
        discoverScore: scoreResult.discoverScore,
        dataConfidenceFactor: scoreResult.dataConfidenceFactor,
      },
      { userId, currentStep },
    );
  }, [showSummary, hydrated, formData, completeness, scoreResult, userId, currentStep]);

  useEffect(() => {
    if (!showSummary || !hydrated || remoteSaveAttempted.current) return;

    remoteSaveAttempted.current = true;
    void saveRemoteProfile();
  }, [showSummary, hydrated, saveRemoteProfile]);

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

  const handleSubmitForReview = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const saved = await saveRemoteProfile();
      if (!saved) {
        setSubmitError("Please ensure your profile is saved before submitting.");
        return;
      }

      const response = await fetch("/api/discover/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          completeness,
          discoverScore: scoreResult.discoverScore,
          dataConfidenceFactor: scoreResult.dataConfidenceFactor,
          privacyAcknowledged: true,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        missingSections?: string[];
      };

      if (!response.ok || !data.ok) {
        setSubmitError(
          data.missingSections?.length
            ? `Please complete: ${data.missingSections.join(", ")}`
            : data.error ?? "Submission failed. Please try again.",
        );
        return;
      }

      clearDiscoverProfile(userId);
      window.location.href = "/discover/submitted";
    } catch {
      setSubmitError("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSection = PROSPECT_PROFILE_SECTIONS.find((section) =>
    section.stepIndices.includes(currentStep),
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

  const recordSectionCompleted = (stepIndex: number) => {
    const section = PROSPECT_PROFILE_SECTIONS.find((item) =>
      item.stepIndices.includes(stepIndex),
    );
    void fetch("/api/prospect/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "prospect_section_completed",
        sectionId: section?.id ?? `step_${stepIndex}`,
      }),
    });
  };

  const handleContinue = () => {
    recordSectionCompleted(currentStep);
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
    0: "Basic details about you — name, age, and where you live.",
    1: "Partner, children, and anyone who depends on you financially.",
    2: "Your salary, bonuses, and other income sources.",
    3: "Monthly spending — essentials, housing, and discretionary costs.",
    4: "Savings, CPF, property, and other things you own.",
    5: "Mortgages, loans, and other money you owe.",
    6: "Life, health, and disability coverage you already have.",
    7: "Investments, risk comfort, and how much you save each month.",
    8: "When you want to retire and the lifestyle you hope for.",
    9: "Will, CPF nomination, and how wealth passes to loved ones.",
    10: "Business ownership and family planning, if relevant to you.",
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
        onSubmit={handleSubmitForReview}
        saveWarning={saveWarning}
        isSavingRemote={isSavingRemote}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    );
  }

  return (
    <div>
      <ProspectSectionProgress
        currentStep={currentStep}
        completeness={completeness}
      />

      {currentSection ? (
        <p className="mb-4 text-sm font-light text-[#F3F1EA]/45">
          {currentSection.description}
        </p>
      ) : null}

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
        <p className="text-center text-xs font-light text-[#F3F1EA]/40 sm:text-left">
          Section progress · saves automatically as you go
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void saveRemoteProfile()}
            disabled={isSavingRemote}
            className="rounded-sm border border-[#D1A866]/15 px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/50"
          >
            {isSavingRemote ? "Saving…" : "Save progress"}
          </button>
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
