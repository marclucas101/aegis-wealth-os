/**
 * Policy identity and duplicate-candidate matching (Phase 07).
 * Weak matches surface candidates only — no silent merge.
 */

import type { CrmProtectionPolicyCategory } from "@/lib/crm-v2/protection/types";

export type ProtectionDuplicateCandidateInput = {
  policyId: string;
  insurer: string;
  policyRefMasked: string | null;
  policyCategory: CrmProtectionPolicyCategory;
  policyStartDate: string | null;
  lifeAssured: string;
  policyOwner: string;
};

export type ProtectionDuplicateMatchInput = {
  insurer: string;
  policyRefMasked: string | null;
  policyCategory: CrmProtectionPolicyCategory;
  policyStartDate: string | null;
  lifeAssured: string;
  policyOwner: string;
};

export type ProtectionDuplicateCandidate = {
  policyId: string;
  matchScore: number;
  matchSignals: string[];
};

const STRONG_REF_SCORE = 100;
const INSURER_CATEGORY_SCORE = 40;
const LIFE_ASSURED_SCORE = 25;
const OWNER_SCORE = 15;
const START_DATE_SCORE = 20;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Masks a policy number for storage and DTO exposure.
 * Full numbers must never appear in normal UI.
 */
export function maskPolicyNumber(policyNumber: string): string | null {
  const cleaned = policyNumber.replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.length <= 4) return `***${cleaned}`;
  return `***${cleaned.slice(-4)}`;
}

export function findDuplicateCandidates(
  input: ProtectionDuplicateMatchInput,
  existingPolicies: ProtectionDuplicateCandidateInput[],
): ProtectionDuplicateCandidate[] {
  const candidates: ProtectionDuplicateCandidate[] = [];

  for (const policy of existingPolicies) {
    const signals: string[] = [];
    let score = 0;

    if (
      input.policyRefMasked &&
      policy.policyRefMasked &&
      normalizeText(input.policyRefMasked) === normalizeText(policy.policyRefMasked)
    ) {
      score += STRONG_REF_SCORE;
      signals.push("masked_policy_ref");
    }

    if (normalizeText(input.insurer) === normalizeText(policy.insurer)) {
      score += INSURER_CATEGORY_SCORE;
      signals.push("insurer");
    }

    if (input.policyCategory === policy.policyCategory) {
      score += 10;
      signals.push("policy_category");
    }

    if (normalizeText(input.lifeAssured) === normalizeText(policy.lifeAssured)) {
      score += LIFE_ASSURED_SCORE;
      signals.push("life_assured");
    }

    if (normalizeText(input.policyOwner) === normalizeText(policy.policyOwner)) {
      score += OWNER_SCORE;
      signals.push("policy_owner");
    }

    const inputDate = normalizeDate(input.policyStartDate);
    const policyDate = normalizeDate(policy.policyStartDate);
    if (inputDate && policyDate && inputDate === policyDate) {
      score += START_DATE_SCORE;
      signals.push("commencement_date");
    }

    if (score >= INSURER_CATEGORY_SCORE) {
      candidates.push({ policyId: policy.policyId, matchScore: score, matchSignals: signals });
    }
  }

  return candidates.sort((a, b) => b.matchScore - a.matchScore);
}

export function requiresAdviserDuplicateDecision(
  candidates: ProtectionDuplicateCandidate[],
): boolean {
  if (candidates.length === 0) return false;
  const top = candidates[0];
  if (top.matchScore >= STRONG_REF_SCORE) return true;
  return candidates.length > 1 && candidates[1].matchScore >= INSURER_CATEGORY_SCORE;
}

export function buildVersionHash(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  let hash = 0;
  for (let i = 0; i < stable.length; i += 1) {
    hash = (hash * 31 + stable.charCodeAt(i)) >>> 0;
  }
  return `v${hash.toString(16)}`;
}
