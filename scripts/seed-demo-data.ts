/**
 * Phase 4Y — Safe fictional demo seed data.
 * Manually invoked only. Never runs in production automatically.
 *
 * Run: npm run demo:seed
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildClientFinancialProfile,
  computeAnnualReviewFromProfile,
  computeBlueprintFromProfile,
  computeCompleteness,
  computeDashboardFromProfile,
  computeRoadmapFromProfile,
  refreshDiscoverScores,
  type DiscoverFormData,
  type DiscoverStoredProfile,
  type RoadmapItemStatus,
} from "@/lib/aegis/localProfile";
import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import type { RoadmapItem, ShieldPillar } from "@/src/lib/scoring/types";

// ---------------------------------------------------------------------------
// Demo constants — exported for clear-demo-data.ts
// ---------------------------------------------------------------------------

export const DEMO_EMAIL_DOMAIN = "aegis-demo.local";
export const DEMO_PASSWORD = "AegisDemo2026!";
export const DEMO_SEED_VERSION = "4Y";
export const SCORE_VERSION = "v1";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type DemoRole = "admin" | "advisor" | "client";

export type DemoPersona = {
  key: string;
  email: string;
  fullName: string;
  role: DemoRole;
  displayName?: string;
  clientStatus?: "prospect" | "onboarding" | "active" | "review_due" | "archived";
  profileSummary: string;
  seedDiscover: boolean;
  buildFormData?: () => DiscoverFormData;
  roadmapStatuses?: Record<string, RoadmapItemStatus>;
  seedReports?: boolean;
  seedDocuments?: boolean;
  reviewMonthsAgo?: number | null;
  nextReviewDue?: string | null;
  onboardingStep?: string | null;
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: "admin",
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Demo Admin",
    role: "admin",
    profileSummary: "Platform administrator for role and access demos.",
    seedDiscover: false,
  },
  {
    key: "advisor",
    email: `advisor@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Demo Advisor",
    role: "advisor",
    profileSummary: "Assigned advisor for all demo client households.",
    seedDiscover: false,
  },
  {
    key: "alex-tan",
    email: `alex.tan@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Alex Tan",
    role: "client",
    displayName: "Alex Tan",
    clientStatus: "active",
    profileSummary:
      "High-income professional with strong growth profile and incomplete estate planning.",
    seedDiscover: true,
    buildFormData: buildAlexTanFormData,
    seedReports: true,
    seedDocuments: true,
    reviewMonthsAgo: 6,
  },
  {
    key: "priya-nair",
    email: `priya.nair@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Priya Nair",
    role: "client",
    displayName: "Priya Nair",
    clientStatus: "active",
    profileSummary:
      "Business owner with asset concentration risk and overdue annual review.",
    seedDiscover: true,
    buildFormData: buildPriyaNairFormData,
    seedDocuments: true,
    reviewMonthsAgo: 16,
  },
  {
    key: "james-lee",
    email: `james.lee@${DEMO_EMAIL_DOMAIN}`,
    fullName: "James Lee",
    role: "client",
    displayName: "James & Mei Lee",
    clientStatus: "active",
    profileSummary:
      "Young family with protection gaps and active roadmap progress.",
    seedDiscover: true,
    buildFormData: buildJamesLeeFormData,
    roadmapStatuses: {
      "protect-adequacy-review": "in_progress",
      "protect-disability": "in_progress",
      "foundation-emergency-fund": "completed",
    },
    seedDocuments: true,
    reviewMonthsAgo: 4,
  },
  {
    key: "margaret-ong",
    email: `margaret.ong@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Margaret Ong",
    role: "client",
    displayName: "Margaret Ong",
    clientStatus: "review_due",
    profileSummary:
      "Pre-retiree with retirement income risk; review due with saved reports.",
    seedDiscover: true,
    buildFormData: buildMargaretOngFormData,
    seedReports: true,
    seedDocuments: true,
    reviewMonthsAgo: 13,
    nextReviewDue: monthsAgoDateString(1),
  },
  {
    key: "sam-wei",
    email: `sam.wei@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Sam Wei",
    role: "client",
    displayName: "Sam Wei",
    clientStatus: "onboarding",
    profileSummary: "Thin onboarding record with minimal Discover completion.",
    seedDiscover: false,
    onboardingStep: "discover_started",
  },
];

// ---------------------------------------------------------------------------
// Env + admin client (scripts cannot import server-only admin.ts)
// ---------------------------------------------------------------------------

function loadDotEnvFile(filePath: string): Record<string, string> {
  const values: Record<string, string> = {};
  if (!existsSync(filePath)) return values;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function resolveEnv(name: string, fileValues: Record<string, string>): string {
  return process.env[name]?.trim() || fileValues[name]?.trim() || "";
}

export function loadDemoEnv(): { url: string; serviceRoleKey: string } {
  const fileValues = loadDotEnvFile(resolve(process.cwd(), ".env.local"));
  const missing: string[] = [];

  for (const name of REQUIRED_ENV) {
    if (!resolveEnv(name, fileValues)) missing.push(name);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Copy .env.example to .env.local.`,
    );
  }

  return {
    url: resolveEnv("NEXT_PUBLIC_SUPABASE_URL", fileValues),
    serviceRoleKey: resolveEnv("SUPABASE_SERVICE_ROLE_KEY", fileValues),
  };
}

export function createScriptAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = loadDemoEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// ---------------------------------------------------------------------------
// Fictional Discover form builders
// ---------------------------------------------------------------------------

function basePersonal(
  firstName: string,
  lastName: string,
  dob: string,
  maritalStatus: string,
  occupation: string,
): DiscoverFormData["personal"] {
  return {
    firstName,
    lastName,
    dateOfBirth: dob,
    nationality: "Singapore",
    maritalStatus,
    occupation,
    residency: "Singapore",
  };
}

function buildAlexTanFormData(): DiscoverFormData {
  return {
    personal: basePersonal("Alex", "Tan", "1982-04-15", "married", "Senior Counsel"),
    family: {
      hasPartner: true,
      partnerName: "Jordan Tan",
      numberOfChildren: "0",
      dependantDetails: "No dependants",
      caregivingResponsibilities: "Parents in good health",
    },
    income: {
      primaryIncome: "320000",
      secondaryIncome: "25000",
      incomeType: "employment",
      employer: "Tan & Associates LLP",
      bonusIncome: "45000",
    },
    expenses: {
      monthlyEssential: "8500",
      monthlyDiscretionary: "4500",
      monthlyHousing: "4200",
      monthlyInsurance: "1200",
      monthlyOther: "1800",
    },
    assets: {
      cashAssets: "180000",
      cpfBalance: "420000",
      propertyValue: "1450000",
      investmentProperty: "0",
      otherAssets: "50000",
    },
    liabilities: {
      mortgageBalance: "520000",
      personalLoans: "0",
      creditCardDebt: "0",
      otherLiabilities: "0",
      totalDebt: "520000",
    },
    policies: {
      lifeInsurance: "800000",
      healthInsurance: "isp_with_rider",
      ciCoverage: "350000",
      disabilityCoverage: "12000",
      hasPolicyReview: true,
    },
    investments: {
      investmentAccounts: "Brokerage, SRS",
      totalInvestments: "680000",
      assetAllocation: "balanced",
      riskProfile: "moderate",
      monthlyContribution: "6000",
    },
    retirement: {
      targetRetirementAge: "62",
      desiredRetirementIncome: "15000",
      currentRetirementSavings: "900000",
      retirementPriority: "high",
      cpfLifePlan: "escalating",
    },
    estate: {
      hasWill: false,
      hasCpfNomination: true,
      hasTrust: false,
      beneficiaryDocumented: false,
      estatePlanReviewed: false,
    },
    business: {
      isBusinessOwner: false,
      businessName: "",
      successionPlan: "none",
      familyGovernance: "basic",
      familyMeetings: "none",
    },
  };
}

function buildPriyaNairFormData(): DiscoverFormData {
  return {
    personal: basePersonal("Priya", "Nair", "1978-09-22", "married", "Founder & CEO"),
    family: {
      hasPartner: true,
      partnerName: "Ravi Nair",
      numberOfChildren: "2",
      dependantDetails: "Ages 14 and 11",
      caregivingResponsibilities: "School fees planning",
    },
    income: {
      primaryIncome: "480000",
      secondaryIncome: "0",
      incomeType: "business",
      employer: "Nair Ventures Pte Ltd",
      bonusIncome: "0",
    },
    expenses: {
      monthlyEssential: "14000",
      monthlyDiscretionary: "9000",
      monthlyHousing: "6500",
      monthlyInsurance: "2800",
      monthlyOther: "3500",
    },
    assets: {
      cashAssets: "420000",
      cpfBalance: "310000",
      propertyValue: "2100000",
      investmentProperty: "850000",
      otherAssets: "1200000",
    },
    liabilities: {
      mortgageBalance: "980000",
      personalLoans: "150000",
      creditCardDebt: "25000",
      otherLiabilities: "200000",
      totalDebt: "1355000",
    },
    policies: {
      lifeInsurance: "1200000",
      healthInsurance: "isp_without_rider",
      ciCoverage: "500000",
      disabilityCoverage: "8000",
      hasPolicyReview: false,
    },
    investments: {
      investmentAccounts: "Private company shares",
      totalInvestments: "2800000",
      assetAllocation: "cash_heavy",
      riskProfile: "aggressive",
      monthlyContribution: "15000",
    },
    retirement: {
      targetRetirementAge: "60",
      desiredRetirementIncome: "22000",
      currentRetirementSavings: "1500000",
      retirementPriority: "medium",
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
      businessName: "Nair Ventures Pte Ltd",
      successionPlan: "informal",
      familyGovernance: "basic",
      familyMeetings: "basic",
    },
  };
}

function buildJamesLeeFormData(): DiscoverFormData {
  return {
    personal: basePersonal("James", "Lee", "1992-01-08", "married", "Product Manager"),
    family: {
      hasPartner: true,
      partnerName: "Mei Lee",
      numberOfChildren: "2",
      dependantDetails: "Toddler and newborn",
      caregivingResponsibilities: "Dual income household",
    },
    income: {
      primaryIncome: "145000",
      secondaryIncome: "18000",
      incomeType: "employment",
      employer: "Horizon Tech SG",
      bonusIncome: "12000",
    },
    expenses: {
      monthlyEssential: "6200",
      monthlyDiscretionary: "2200",
      monthlyHousing: "2800",
      monthlyInsurance: "650",
      monthlyOther: "900",
    },
    assets: {
      cashAssets: "42000",
      cpfBalance: "185000",
      propertyValue: "0",
      investmentProperty: "0",
      otherAssets: "15000",
    },
    liabilities: {
      mortgageBalance: "0",
      personalLoans: "12000",
      creditCardDebt: "3500",
      otherLiabilities: "0",
      totalDebt: "15500",
    },
    policies: {
      lifeInsurance: "250000",
      healthInsurance: "basic_public",
      ciCoverage: "100000",
      disabilityCoverage: "0",
      hasPolicyReview: false,
    },
    investments: {
      investmentAccounts: "Robo-advisor",
      totalInvestments: "85000",
      assetAllocation: "balanced",
      riskProfile: "moderate",
      monthlyContribution: "1800",
    },
    retirement: {
      targetRetirementAge: "65",
      desiredRetirementIncome: "8000",
      currentRetirementSavings: "120000",
      retirementPriority: "medium",
      cpfLifePlan: "standard",
    },
    estate: {
      hasWill: false,
      hasCpfNomination: true,
      hasTrust: false,
      beneficiaryDocumented: false,
      estatePlanReviewed: false,
    },
    business: {
      isBusinessOwner: false,
      businessName: "",
      successionPlan: "none",
      familyGovernance: "none",
      familyMeetings: "none",
    },
  };
}

function buildMargaretOngFormData(): DiscoverFormData {
  return {
    personal: basePersonal("Margaret", "Ong", "1967-11-30", "married", "Operations Director"),
    family: {
      hasPartner: true,
      partnerName: "David Ong",
      numberOfChildren: "1",
      dependantDetails: "Adult child, financially independent",
      caregivingResponsibilities: "Occasional parent support",
    },
    income: {
      primaryIncome: "210000",
      secondaryIncome: "0",
      incomeType: "employment",
      employer: "Pacific Logistics Group",
      bonusIncome: "30000",
    },
    expenses: {
      monthlyEssential: "7500",
      monthlyDiscretionary: "2800",
      monthlyHousing: "0",
      monthlyInsurance: "1400",
      monthlyOther: "1200",
    },
    assets: {
      cashAssets: "95000",
      cpfBalance: "680000",
      propertyValue: "980000",
      investmentProperty: "0",
      otherAssets: "40000",
    },
    liabilities: {
      mortgageBalance: "0",
      personalLoans: "0",
      creditCardDebt: "0",
      otherLiabilities: "0",
      totalDebt: "0",
    },
    policies: {
      lifeInsurance: "600000",
      healthInsurance: "isp_with_rider",
      ciCoverage: "400000",
      disabilityCoverage: "0",
      hasPolicyReview: true,
    },
    investments: {
      investmentAccounts: "CPF, unit trusts",
      totalInvestments: "320000",
      assetAllocation: "conservative",
      riskProfile: "conservative",
      monthlyContribution: "2500",
    },
    retirement: {
      targetRetirementAge: "62",
      desiredRetirementIncome: "12000",
      currentRetirementSavings: "780000",
      retirementPriority: "high",
      cpfLifePlan: "escalating",
    },
    estate: {
      hasWill: true,
      hasCpfNomination: true,
      hasTrust: false,
      beneficiaryDocumented: true,
      estatePlanReviewed: true,
    },
    business: {
      isBusinessOwner: false,
      businessName: "",
      successionPlan: "none",
      familyGovernance: "structured",
      familyMeetings: "structured",
    },
  };
}

function monthsAgoDateString(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthsAgoIso(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}

function daysFromNowDateString(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function withDemoMeta(
  formData: DiscoverFormData,
  personaKey: string,
): DiscoverFormData & { _demoMeta: { personaKey: string; seedVersion: string } } {
  return {
    ...formData,
    _demoMeta: { personaKey, seedVersion: DEMO_SEED_VERSION },
  };
}

function buildStoredProfile(
  persona: DemoPersona,
): DiscoverStoredProfile | null {
  if (!persona.buildFormData) return null;

  const formData = withDemoMeta(persona.buildFormData(), persona.key);
  const completeness = computeCompleteness(formData);
  const refreshed = refreshDiscoverScores({
    version: 1,
    completedAt: new Date().toISOString(),
    formData,
    completeness,
    discoverScore: 0,
    dataConfidenceFactor: 1,
  });

  return refreshed;
}

// ---------------------------------------------------------------------------
// Auth + user provisioning
// ---------------------------------------------------------------------------

type AuthUserRecord = { id: string; email: string };

async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<AuthUserRecord | null> {
  const normalized = email.toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );
    if (match?.email) {
      return { id: match.id, email: match.email };
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

async function ensureDemoAuthUser(
  admin: SupabaseClient,
  persona: DemoPersona,
): Promise<AuthUserRecord> {
  const existing = await findAuthUserByEmail(admin, persona.email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: persona.fullName,
        demo: true,
        demo_seed_version: DEMO_SEED_VERSION,
        demo_persona_key: persona.key,
      },
    });
    if (error) {
      throw new Error(`Failed to update demo user ${persona.email}: ${error.message}`);
    }
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: persona.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: persona.fullName,
      demo: true,
      demo_seed_version: DEMO_SEED_VERSION,
      demo_persona_key: persona.key,
    },
  });

  if (error || !data.user?.email) {
    throw new Error(
      `Failed to create demo user ${persona.email}: ${error?.message ?? "unknown"}`,
    );
  }

  return { id: data.user.id, email: data.user.email };
}

async function ensurePublicUser(
  admin: SupabaseClient,
  authUser: AuthUserRecord,
  persona: DemoPersona,
): Promise<void> {
  const { error } = await admin.from("users").upsert(
    {
      id: authUser.id,
      email: authUser.email,
      full_name: persona.fullName,
      role: persona.role,
      organisation: persona.role === "advisor" ? "Aegis Demo Advisory" : null,
    } as never,
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Failed to upsert public user ${persona.email}: ${error.message}`);
  }
}

type ClientRow = { id: string };

async function findClientForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<ClientRow | null> {
  const { data, error } = await admin
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find client for user: ${error.message}`);
  }

  return data ? (data as ClientRow) : null;
}

async function ensureDemoClient(
  admin: SupabaseClient,
  persona: DemoPersona,
  userId: string,
  advisorUserId: string,
): Promise<ClientRow | null> {
  if (persona.role !== "client") return null;

  const existing = await findClientForUser(admin, userId);
  const payload = {
    user_id: userId,
    advisor_user_id: advisorUserId,
    status: persona.clientStatus ?? "active",
    display_name: persona.displayName ?? persona.fullName,
    email: persona.email,
    phone: "+65-6000-0000",
    currency_code: "SGD",
    onboarding_step: persona.onboardingStep ?? null,
    last_review_at: persona.reviewMonthsAgo
      ? monthsAgoIso(persona.reviewMonthsAgo)
      : null,
    next_review_due: persona.nextReviewDue ?? null,
  };

  if (existing) {
    const { error } = await admin
      .from("clients")
      .update(payload as never)
      .eq("id", existing.id);
    if (error) {
      throw new Error(`Failed to update client ${persona.email}: ${error.message}`);
    }
    return existing;
  }

  const { data, error } = await admin
    .from("clients")
    .insert(payload as never)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create client ${persona.email}: ${error?.message ?? "unknown"}`);
  }

  return data as ClientRow;
}

// ---------------------------------------------------------------------------
// Scoring snapshot persistence (mirrors discoverPersistence.ts)
// ---------------------------------------------------------------------------

function roadmapStatusTimestamps(
  status: RoadmapItemStatus,
): { started_at: string | null; completed_at: string | null } {
  const now = new Date().toISOString();
  if (status === "completed") return { started_at: now, completed_at: now };
  if (status === "in_progress") return { started_at: now, completed_at: null };
  return { started_at: null, completed_at: null };
}

function mapRoadmapItemToRow(
  item: RoadmapItem,
  clientId: string,
  shieldScoreId: string,
) {
  const timestamps = roadmapStatusTimestamps(item.status);
  return {
    client_id: clientId,
    shield_score_id: shieldScoreId,
    item_key: item.id,
    is_active: true,
    score_version: SCORE_VERSION,
    title: item.title,
    pillar: item.pillar,
    current_score: item.currentScore,
    target_score: item.targetScore,
    estimated_impact: item.estimatedImpact,
    timeline_months: item.timelineMonths,
    difficulty: item.difficulty,
    priority: item.priority,
    status: item.status,
    gap_severity: item.gapSeverity ?? null,
    stress_exposure: item.stressExposure ?? null,
    impact_potential: item.impactPotential ?? null,
    urgency: item.urgency ?? null,
    started_at: timestamps.started_at,
    completed_at: timestamps.completed_at,
  };
}

async function hasCurrentDiscoverForPersona(
  admin: SupabaseClient,
  clientId: string,
  personaKey: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("discover_profiles")
    .select("form_data")
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check discover profile: ${error.message}`);
  }

  if (!data) return false;

  const formData = (data as { form_data: { _demoMeta?: { personaKey?: string } } })
    .form_data;
  return formData?._demoMeta?.personaKey === personaKey;
}

async function persistScoringSnapshot(
  admin: SupabaseClient,
  clientId: string,
  stored: DiscoverStoredProfile,
  roadmapStatuses: Record<string, RoadmapItemStatus> = {},
): Promise<{ shieldScoreId: string }> {
  const financialProfile = buildClientFinancialProfile(stored);
  const dashboard = computeDashboardFromProfile(stored);
  const roadmapResults = computeRoadmapFromProfile(stored, roadmapStatuses);

  const { shield, awri, benchmark, stressTests, insights } = dashboard;
  const { roadmap, projected } = roadmapResults;
  const clientSummary = financialProfile.profile!;
  const completedAt = stored.completedAt;

  await admin
    .from("discover_profiles")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  const { data: discoverRow, error: discoverError } = await admin
    .from("discover_profiles")
    .insert({
      client_id: clientId,
      version: 1,
      is_current: true,
      completed_at: completedAt,
      form_data: stored.formData as never,
      completeness: stored.completeness as never,
      discover_score: stored.discoverScore,
      data_confidence_factor: stored.dataConfidenceFactor,
    } as never)
    .select("id")
    .single();

  if (discoverError || !discoverRow) {
    throw new Error(`Failed to insert discover profile: ${discoverError?.message}`);
  }

  const discoverProfileId = (discoverRow as { id: string }).id;

  await admin
    .from("financial_profiles")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  const { data: financialRow, error: financialError } = await admin
    .from("financial_profiles")
    .insert({
      client_id: clientId,
      discover_profile_id: discoverProfileId,
      is_current: true,
      profile_data: financialProfile as never,
      annual_income: clientSummary.income,
      net_worth: clientSummary.netWorth,
      total_debt: financialProfile.foundation.totalDebt,
      monthly_surplus: financialProfile.foundation.monthlySurplus,
      savings_rate: financialProfile.grow.savingsRate,
      is_business_owner: clientSummary.isBusinessOwner,
    } as never)
    .select("id")
    .single();

  if (financialError || !financialRow) {
    throw new Error(`Failed to insert financial profile: ${financialError?.message}`);
  }

  const financialProfileId = (financialRow as { id: string }).id;

  await admin
    .from("shield_scores")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  const { data: shieldRow, error: shieldError } = await admin
    .from("shield_scores")
    .insert({
      client_id: clientId,
      discover_profile_id: discoverProfileId,
      financial_profile_id: financialProfileId,
      is_current: true,
      score_version: SCORE_VERSION,
      snapshot_reason: "demo_seed",
      raw_shield_score: shield.rawShieldScore,
      adjusted_shield_score: shield.adjustedShieldScore,
      data_confidence_factor: shield.dataConfidenceFactor,
      discover_score: shield.discoverScore,
      rating: shield.rating,
      awri: awri.awri,
      awri_rating: awri.rating,
      resilience_score: awri.resilienceScore,
      behaviour_score: awri.behaviourScore,
      governance_score: awri.governanceScore,
      continuity_score: awri.continuityScore,
      benchmark_cohort: benchmark.cohort,
      benchmark_cohort_average: benchmark.cohortAverage,
      benchmark_top_25: benchmark.top25,
      benchmark_top_10: benchmark.top10,
      benchmark_delta: benchmark.benchmarkDelta,
      benchmark_classification: benchmark.classification,
      weakest_pillar: insights.weakestPillar,
      strongest_pillar: insights.strongestPillar,
      projected_raw_shield_score: projected.projectedRawShieldScore,
      projected_adjusted_shield_score: projected.projectedAdjustedShieldScore,
      projected_rating: projected.projectedRating,
    } as never)
    .select("id")
    .single();

  if (shieldError || !shieldRow) {
    throw new Error(`Failed to insert shield score: ${shieldError?.message}`);
  }

  const shieldScoreId = (shieldRow as { id: string }).id;

  const pillarRows = (Object.keys(SHIELD_PILLAR_WEIGHTS) as ShieldPillar[]).map(
    (pillar) => {
      const score = shield.pillarScores[pillar];
      const weight = SHIELD_PILLAR_WEIGHTS[pillar];
      return {
        shield_score_id: shieldScoreId,
        client_id: clientId,
        pillar,
        score_version: SCORE_VERSION,
        score,
        weight,
        weighted_contribution: Math.round(score * weight * 1000) / 1000,
      };
    },
  );

  const { error: pillarError } = await admin
    .from("pillar_scores")
    .insert(pillarRows as never);
  if (pillarError) throw new Error(`Failed to insert pillar scores: ${pillarError.message}`);

  const stressRows = stressTests.map((test) => ({
    shield_score_id: shieldScoreId,
    client_id: clientId,
    scenario: test.scenario,
    severity: test.severity,
    score_version: SCORE_VERSION,
    pre_stress_score: test.preStressScore,
    post_stress_score: test.postStressScore,
    stress_penalty: test.stressPenalty,
    mitigation_credit: test.mitigationCredit,
    affected_pillars: test.affectedPillars as never,
  }));

  const { error: stressError } = await admin
    .from("stress_tests")
    .insert(stressRows as never);
  if (stressError) throw new Error(`Failed to insert stress tests: ${stressError.message}`);

  await admin
    .from("roadmap_items")
    .update({ is_active: false } as never)
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (roadmap.length > 0) {
    const roadmapRows = roadmap.map((item) =>
      mapRoadmapItemToRow(item, clientId, shieldScoreId),
    );
    const { error: roadmapError } = await admin
      .from("roadmap_items")
      .insert(roadmapRows as never);
    if (roadmapError) {
      throw new Error(`Failed to insert roadmap items: ${roadmapError.message}`);
    }
  }

  await admin
    .from("client_profiles")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  const { error: clientProfileError } = await admin.from("client_profiles").insert({
    client_id: clientId,
    discover_profile_id: discoverProfileId,
    is_current: true,
    age: clientSummary.age,
    annual_income: clientSummary.income,
    net_worth: clientSummary.netWorth,
    marital_status: clientSummary.maritalStatus,
    has_children: clientSummary.hasChildren,
    has_partner: clientSummary.hasPartner,
    occupation: clientSummary.occupation ?? null,
    is_business_owner: clientSummary.isBusinessOwner,
    is_retired: clientSummary.isRetired,
    has_multiple_properties: clientSummary.hasMultipleProperties ?? false,
    has_cross_border_assets: clientSummary.hasCrossBorderAssets ?? false,
    has_trust_structure: clientSummary.hasTrustStructure ?? false,
    has_multi_generation_dependants:
      clientSummary.hasMultiGenerationDependants ?? false,
    has_philanthropic_goals: clientSummary.hasPhilanthropicGoals ?? false,
    current_adjusted_shield_score: shield.adjustedShieldScore,
    current_shield_rating: shield.rating,
    weakest_pillar: insights.weakestPillar,
    strongest_pillar: insights.strongestPillar,
  } as never);

  if (clientProfileError) {
    throw new Error(`Failed to insert client profile: ${clientProfileError.message}`);
  }

  return { shieldScoreId };
}

// ---------------------------------------------------------------------------
// Reports, documents, notes, tasks, audit
// ---------------------------------------------------------------------------

async function seedReports(
  admin: SupabaseClient,
  clientId: string,
  stored: DiscoverStoredProfile,
  shieldScoreId: string,
  reviewMonthsAgo: number | null | undefined,
  includeBlueprint: boolean,
): Promise<void> {
  const blueprint = computeBlueprintFromProfile(stored);
  const annual = computeAnnualReviewFromProfile(
    stored,
    Object.fromEntries(
      blueprint.roadmap.map((item) => [item.id, item.status]),
    ) as Record<string, RoadmapItemStatus>,
  );

  const generatedAt = reviewMonthsAgo
    ? monthsAgoIso(reviewMonthsAgo)
    : new Date().toISOString();
  const reviewYear = new Date(generatedAt).getFullYear();

  const formattedDate = new Date(generatedAt).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const improvement =
    blueprint.projected.projectedAdjustedShieldScore -
    blueprint.shield.adjustedShieldScore;

  const { count: blueprintCount } = await admin
    .from("wealth_blueprints")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .ilike("title", "%(Demo)%");

  if (includeBlueprint && !blueprintCount) {
    const reportData = {
      ...blueprint,
      generatedAt,
      discoverScore: blueprint.shield.discoverScore,
      dataConfidenceFactor: blueprint.shield.dataConfidenceFactor,
      pillarAnalysis: {
        pillarScores: blueprint.shield.pillarScores,
        weakestPillars: blueprint.weakestPillars,
      },
      stressTestSummary: {
        tests: blueprint.stressTests,
        topExposures: blueprint.topStressExposures,
      },
      roadmapStatusSummary: {
        completed: blueprint.roadmap.filter((i) => i.status === "completed").length,
        inProgress: blueprint.roadmap.filter((i) => i.status === "in_progress").length,
        notStarted: blueprint.roadmap.filter((i) => i.status === "not_started").length,
        total: blueprint.roadmap.length,
        items: blueprint.roadmap.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          pillar: item.pillar,
        })),
      },
      _demoMeta: { seedVersion: DEMO_SEED_VERSION },
    };

    const { error } = await admin.from("wealth_blueprints").insert({
      client_id: clientId,
      shield_score_id: shieldScoreId,
      report_type: "wealth_architecture_blueprint",
      score_version: SCORE_VERSION,
      title: `Wealth Architecture Blueprint™ — ${formattedDate} (Demo)`,
      executive_summary: `Demo blueprint: Adjusted Shield Score ${blueprint.shield.adjustedShieldScore.toFixed(1)} (${blueprint.shield.rating}). Projected improvement ${improvement.toFixed(1)} points.`,
      report_data: reportData as never,
      adjusted_shield_score: blueprint.shield.adjustedShieldScore,
      awri: blueprint.awri.awri,
      rating: blueprint.shield.rating,
      generated_at: generatedAt,
    } as never);

    if (error) throw new Error(`Failed to seed wealth blueprint: ${error.message}`);
  }

  const { error: reviewError } = await admin.from("annual_reviews").upsert(
    {
      client_id: clientId,
      shield_score_id: shieldScoreId,
      review_year: reviewYear,
      review_label: `${reviewYear} Annual Shield Review (Demo)`,
      score_version: SCORE_VERSION,
      adjusted_shield_score: annual.shield.adjustedShieldScore,
      rating: annual.shield.rating,
      discover_score: annual.discoverScore,
      data_confidence_factor: annual.dataConfidenceFactor,
      awri: annual.awri.awri,
      projected_adjusted_score: annual.projected.projectedAdjustedShieldScore,
      total_improvement: annual.totalImprovement,
      timeline: { years: annual.timeline, _demoMeta: { seedVersion: DEMO_SEED_VERSION } } as never,
      top_stress_exposures: annual.topStressExposures as never,
      weakest_pillars: annual.weakestPillars as never,
      actions_completed: annual.roadmap.filter((i) => i.status === "completed").length,
      actions_total: annual.roadmap.length,
      generated_at: generatedAt,
    } as never,
    { onConflict: "client_id,review_year" },
  );

  if (reviewError) throw new Error(`Failed to seed annual review: ${reviewError.message}`);
}

type DocumentSeed = {
  category: string;
  title: string;
  fileName: string;
};

const DOCUMENT_SEEDS: Record<string, DocumentSeed[]> = {
  "alex-tan": [
    { category: "insurance_policy", title: "Term life policy summary", fileName: "term-life-summary.pdf" },
    { category: "investment_statement", title: "Brokerage statement Q1", fileName: "brokerage-q1.pdf" },
    { category: "cpf", title: "CPF statement", fileName: "cpf-statement.pdf" },
  ],
  "priya-nair": [
    { category: "business_ownership", title: "Shareholder register extract", fileName: "shareholder-register.pdf" },
  ],
  "james-lee": [
    { category: "insurance_policy", title: "Hospitalisation plan", fileName: "hospital-plan.pdf" },
    { category: "cpf", title: "CPF contribution history", fileName: "cpf-history.pdf" },
  ],
  "margaret-ong": [
    { category: "insurance_policy", title: "Retirement income policy", fileName: "retirement-policy.pdf" },
    { category: "investment_statement", title: "Unit trust statement", fileName: "unit-trust.pdf" },
    { category: "cpf", title: "CPF retirement account", fileName: "cpf-ra.pdf" },
    { category: "will", title: "Will execution summary", fileName: "will-summary.pdf" },
    { category: "financial_statement", title: "Bank statements", fileName: "bank-statements.pdf" },
  ],
};

async function seedDocuments(
  admin: SupabaseClient,
  clientId: string,
  personaKey: string,
  uploadedByUserId: string,
): Promise<void> {
  const seeds = DOCUMENT_SEEDS[personaKey] ?? [];
  for (const doc of seeds) {
    const storagePath = `demo/${clientId}/${personaKey}-${doc.fileName}`;

    const { data: existing } = await admin
      .from("documents")
      .select("id")
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (existing) continue;

    const { error } = await admin.from("documents").insert({
      client_id: clientId,
      uploaded_by_user_id: uploadedByUserId,
      category: doc.category,
      title: doc.title,
      description: "DEMO PLACEHOLDER — metadata only; no file uploaded to storage.",
      file_name: doc.fileName,
      mime_type: "application/pdf",
      file_size_bytes: 0,
      storage_bucket: "client-documents",
      storage_path: storagePath,
      tags: ["demo", "placeholder"],
    } as never);

    if (error) throw new Error(`Failed to seed document ${doc.title}: ${error.message}`);
  }
}

async function seedAdvisorNotes(
  admin: SupabaseClient,
  advisorUserId: string,
  clientMap: Record<string, string>,
): Promise<void> {
  const notes = [
    {
      key: "alex-tan",
      title: "Estate planning follow-up",
      body: "Alex has strong liquidity and investments but no will on file. Schedule estate planning workshop.",
      note_type: "follow_up",
      pillar: "legacy" as ShieldPillar,
    },
    {
      key: "priya-nair",
      title: "Concentration risk review",
      body: "Business and private holdings dominate net worth. Discuss diversification and succession formalisation.",
      note_type: "risk",
      pillar: "grow" as ShieldPillar,
    },
    {
      key: "james-lee",
      title: "Protection gap meeting",
      body: "Family protection below target. Review CI and disability coverage at next touchpoint.",
      note_type: "meeting",
      pillar: "protect" as ShieldPillar,
    },
    {
      key: "margaret-ong",
      title: "Pre-retirement income check",
      body: "Retirement income projection below desired lifestyle. Annual review due this quarter.",
      note_type: "review",
      pillar: "preserve" as ShieldPillar,
    },
  ];

  for (const note of notes) {
    const clientId = clientMap[note.key];
    if (!clientId) continue;

    const { count } = await admin
      .from("advisor_notes")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("title", note.title);

    if (count && count > 0) continue;

    const { error } = await admin.from("advisor_notes").insert({
      client_id: clientId,
      advisor_user_id: advisorUserId,
      title: note.title,
      body: note.body,
      note_type: note.note_type,
      related_pillar: note.pillar,
      is_pinned: note.key === "priya-nair",
    } as never);

    if (error) throw new Error(`Failed to seed advisor note: ${error.message}`);
  }
}

async function seedAdvisorTasks(
  admin: SupabaseClient,
  advisorUserId: string,
  clientMap: Record<string, string>,
): Promise<void> {
  const tasks = [
    {
      clientKey: "margaret-ong",
      title: "Schedule annual Shield review",
      description: "Margaret is review due — confirm meeting date.",
      task_type: "review",
      priority: "high",
      status: "open",
      due_date: daysFromNowDateString(3),
    },
    {
      clientKey: "priya-nair",
      title: "Overdue review escalation",
      description: "Annual review overdue by 4+ months. Escalate to partner.",
      task_type: "review",
      priority: "urgent",
      status: "open",
      due_date: daysFromNowDateString(-7),
    },
    {
      clientKey: "alex-tan",
      title: "Estate planning document request",
      description: "Request will draft or executor details for vault.",
      task_type: "document",
      priority: "medium",
      status: "in_progress",
      due_date: daysFromNowDateString(10),
    },
    {
      clientKey: "james-lee",
      title: "Protection quote follow-up",
      description: "Send revised CI quote after Discover review.",
      task_type: "follow_up",
      priority: "medium",
      status: "open",
      due_date: daysFromNowDateString(5),
    },
    {
      clientKey: "sam-wei",
      title: "Complete Discover onboarding",
      description: "Sam started Discover but has not submitted. Send reminder.",
      task_type: "follow_up",
      priority: "high",
      status: "open",
      due_date: daysFromNowDateString(2),
    },
    {
      clientKey: null,
      title: "Demo book hygiene check",
      description: "Review file-quality dashboard after demo seed.",
      task_type: "general",
      priority: "low",
      status: "open",
      due_date: daysFromNowDateString(14),
    },
  ];

  for (const task of tasks) {
    const clientId = task.clientKey ? clientMap[task.clientKey] : null;

    const query = admin
      .from("advisor_tasks")
      .select("id", { count: "exact", head: true })
      .eq("title", task.title)
      .eq("assigned_to_user_id", advisorUserId);

    const { count } = await query;
    if (count && count > 0) continue;

    const { error } = await admin.from("advisor_tasks").insert({
      client_id: clientId,
      assigned_to_user_id: advisorUserId,
      created_by_user_id: advisorUserId,
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
    } as never);

    if (error) throw new Error(`Failed to seed advisor task: ${error.message}`);
  }
}

async function seedAuditLogs(
  admin: SupabaseClient,
  advisorUserId: string,
  adminUserId: string,
  clientMap: Record<string, string>,
): Promise<void> {
  const entries = [
    {
      userId: advisorUserId,
      clientId: clientMap["alex-tan"],
      action: "demo_seed.discover_saved",
      entityType: "discover_profile",
      metadata: { demo: true, persona: "alex-tan" },
    },
    {
      userId: advisorUserId,
      clientId: clientMap["priya-nair"],
      action: "demo_seed.note_created",
      entityType: "advisor_note",
      metadata: { demo: true, persona: "priya-nair", note_type: "risk" },
    },
    {
      userId: adminUserId,
      clientId: null,
      action: "demo_seed.environment_ready",
      entityType: "demo_environment",
      metadata: { demo: true, seed_version: DEMO_SEED_VERSION },
    },
  ];

  for (const entry of entries) {
    const { count } = await admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", entry.action)
      .contains("metadata", { demo: true } as never);

    if (count && count > 0) continue;

    const { error } = await admin.from("audit_logs").insert({
      client_id: entry.clientId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      metadata: entry.metadata as never,
      ip_address: "127.0.0.1",
      user_agent: "demo-seed-script",
    } as never);

    if (error) throw new Error(`Failed to seed audit log: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Aegis Wealth OS — Demo Seed (Phase 4Y)\n");
  console.log("Fictional data only. Manually invoked — not for production.\n");

  const admin = createScriptAdminClient();
  const forceReseed = process.argv.includes("--force");

  const userIds: Record<string, string> = {};
  const clientIds: Record<string, string> = {};

  const staffPersonas = DEMO_PERSONAS.filter((p) => p.role !== "client");
  const clientPersonas = DEMO_PERSONAS.filter((p) => p.role === "client");

  for (const persona of staffPersonas) {
    const authUser = await ensureDemoAuthUser(admin, persona);
    await ensurePublicUser(admin, authUser, persona);
    userIds[persona.key] = authUser.id;
    console.log(`  OK   ${persona.role.padEnd(7)} ${persona.email}`);
  }

  const advisorUserId = userIds.advisor;
  const adminUserId = userIds.admin;

  if (!advisorUserId || !adminUserId) {
    throw new Error("Demo advisor and admin users are required.");
  }

  for (const persona of clientPersonas) {
    const authUser = await ensureDemoAuthUser(admin, persona);
    await ensurePublicUser(admin, authUser, persona);
    userIds[persona.key] = authUser.id;

    const client = await ensureDemoClient(admin, persona, authUser.id, advisorUserId);
    if (client) {
      clientIds[persona.key] = client.id;
    }

    console.log(`  OK   client  ${persona.email} (${persona.clientStatus ?? "n/a"})`);
  }

  for (const persona of clientPersonas) {
    if (!persona.seedDiscover) continue;

    const clientId = clientIds[persona.key];
    if (!clientId) continue;

    const stored = buildStoredProfile(persona);
    if (!stored) continue;

    const alreadySeeded = await hasCurrentDiscoverForPersona(
      admin,
      clientId,
      persona.key,
    );

    if (alreadySeeded && !forceReseed) {
      console.log(`  SKIP scoring ${persona.key} (already seeded; use --force to refresh)`);

      const { data: shieldRow } = await admin
        .from("shield_scores")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_current", true)
        .maybeSingle();

      if (shieldRow && (persona.seedReports || persona.reviewMonthsAgo != null)) {
        await seedReports(
          admin,
          clientId,
          stored,
          (shieldRow as { id: string }).id,
          persona.reviewMonthsAgo,
          Boolean(persona.seedReports),
        );
      }
      continue;
    }

    const { shieldScoreId } = await persistScoringSnapshot(
      admin,
      clientId,
      stored,
      persona.roadmapStatuses ?? {},
    );

    await admin
      .from("clients")
      .update({ date_of_birth: stored.formData.personal.dateOfBirth } as never)
      .eq("id", clientId);

    if (persona.clientStatus === "review_due") {
      await admin
        .from("clients")
        .update({ status: "review_due" } as never)
        .eq("id", clientId);
    }

    console.log(
      `  OK   scoring ${persona.key} (shield snapshot ${shieldScoreId.slice(0, 8)}…)`,
    );

    if (persona.seedReports || persona.reviewMonthsAgo != null) {
      await seedReports(
        admin,
        clientId,
        stored,
        shieldScoreId,
        persona.reviewMonthsAgo,
        Boolean(persona.seedReports),
      );
      console.log(
        `  OK   reports  ${persona.key}${persona.seedReports ? "" : " (annual review only)"}`,
      );
    }

    if (persona.seedDocuments) {
      await seedDocuments(admin, clientId, persona.key, advisorUserId);
      console.log(`  OK   docs     ${persona.key} (metadata only)`);
    }
  }

  await seedAdvisorNotes(admin, advisorUserId, clientIds);
  console.log("  OK   advisor notes");

  await seedAdvisorTasks(admin, advisorUserId, clientIds);
  console.log("  OK   advisor tasks");

  await seedAuditLogs(admin, advisorUserId, adminUserId, clientIds);
  console.log("  OK   audit log samples");

  console.log("\nDemo seed complete.");
  console.log(`Login domain: @${DEMO_EMAIL_DOMAIN}`);
  console.log("Password: (see docs/DEMO_ENVIRONMENT.md — not printed here)");
  console.log("Run: npx tsx scripts/demo-login-guide.ts");
}

const isDirectRun = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("scripts/seed-demo-data.ts");

if (isDirectRun) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nDemo seed failed: ${message}`);
    process.exit(1);
  });
}
