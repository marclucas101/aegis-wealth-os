import type { BinderSection } from "@/lib/binder/binderSectionPolicy";
import {
  BINDER_MANDATORY_SECTIONS,
  BINDER_SECTIONS,
} from "@/lib/binder/binderSectionPolicy";
import type { PublishedOutputType } from "@/lib/compliance/types";

/** Canonical binder section identifiers — single registry for all layers. */
export const BINDER_SECTION_IDS = BINDER_SECTIONS;

export type BinderSectionId = BinderSection;

export const BINDER_AUTO_INCLUDED_SECTIONS = [
  ...BINDER_MANDATORY_SECTIONS,
] as const satisfies readonly BinderSectionId[];

/** Bounded legacy aliases confirmed in AEGIS UI/API drift. */
export const BINDER_SECTION_ALIASES = {
  wealth_roadmap: "roadmap",
  roadmap_summary: "roadmap",
} as const satisfies Record<string, BinderSectionId>;

export type BinderSectionAlias = keyof typeof BINDER_SECTION_ALIASES;

const CANONICAL_SET = new Set<string>(BINDER_SECTION_IDS);

/** Binder section → published output types used for source resolution. */
export const BINDER_SECTION_OUTPUT_TYPES: Partial<
  Record<BinderSectionId, PublishedOutputType[]>
> = {
  financial_overview: ["financial_overview", "financial_readiness_snapshot"],
  my_plan: ["client_plan_summary", "goal_plan_summary", "wealth_blueprint_summary"],
  agreed_priorities: ["goal_plan_summary", "client_plan_summary"],
  roadmap: ["roadmap_summary"],
  meeting_summary: ["meeting_summary", "annual_review_summary"],
};

export function isBinderSectionId(value: string): value is BinderSectionId {
  return CANONICAL_SET.has(value);
}

export function normalizeBinderSectionId(
  raw: string,
): BinderSectionId | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (isBinderSectionId(trimmed)) {
    return trimmed;
  }

  const alias = BINDER_SECTION_ALIASES[trimmed as BinderSectionAlias];
  if (alias) {
    return alias;
  }

  return null;
}

export function normalizeBinderSectionIds(
  rawSectionIds: string[],
): {
  canonical: BinderSectionId[];
  rejected: string[];
} {
  const canonical: BinderSectionId[] = [];
  const rejected: string[] = [];
  const seen = new Set<BinderSectionId>();

  for (const raw of rawSectionIds) {
    const normalized = normalizeBinderSectionId(raw);
    if (!normalized) {
      rejected.push(raw);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      canonical.push(normalized);
    }
  }

  return { canonical, rejected };
}

const AUTO_INCLUDED_SET = new Set<string>(BINDER_AUTO_INCLUDED_SECTIONS);

/** User-selectable content sections only (excludes auto-included metadata). */
export function isSelectableBinderContentSection(sectionId: string): boolean {
  return isBinderSectionId(sectionId) && !AUTO_INCLUDED_SET.has(sectionId);
}

/** Build the full generation section list with auto-included metadata first. */
export function buildGenerationSectionList(
  selectedContentSectionIds: string[],
): BinderSectionId[] {
  const normalized = normalizeBinderSectionIds(selectedContentSectionIds);
  const contentOnly = normalized.canonical.filter(isSelectableBinderContentSection);

  const merged: BinderSectionId[] = [];
  const seen = new Set<BinderSectionId>();

  for (const sectionId of BINDER_AUTO_INCLUDED_SECTIONS) {
    if (!seen.has(sectionId)) {
      seen.add(sectionId);
      merged.push(sectionId);
    }
  }

  for (const sectionId of contentOnly) {
    if (!seen.has(sectionId)) {
      seen.add(sectionId);
      merged.push(sectionId);
    }
  }

  return merged;
}

export function selectedContentSectionIds(
  sectionIds: string[],
): BinderSectionId[] {
  return normalizeBinderSectionIds(sectionIds).canonical.filter(
    isSelectableBinderContentSection,
  );
}
