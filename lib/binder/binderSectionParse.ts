import "server-only";

import { createRequestId, logError } from "@/lib/ops/logger";

import { BINDER_ERROR_CODES } from "./binderErrors";
import {
  buildGenerationSectionList,
  normalizeBinderSectionIds,
  type BinderSectionId,
} from "./binderSectionRegistry";
import { BINDER_MAX_SECTION_COUNT } from "./binderPdfTypes";

export type ParseBinderSectionsResult =
  | {
      ok: true;
      sections: BinderSectionId[];
      contentSectionIds: BinderSectionId[];
      rawSectionIds: string[];
      rejectedSectionIds: string[];
    }
  | {
      ok: false;
      rawSectionIds: string[];
      rejectedSectionIds: string[];
      reason: "invalid_type" | "unknown_section" | "empty" | "too_many";
    };

export function parseBinderGenerationSections(input: {
  body: Record<string, unknown>;
  requestId?: string;
  clientId?: string | null;
  adviserUserId?: string | null;
}): ParseBinderSectionsResult {
  const requestId = input.requestId ?? createRequestId();

  if (!("sections" in input.body)) {
    return {
      ok: false,
      rawSectionIds: [],
      rejectedSectionIds: [],
      reason: "invalid_type",
    };
  }

  if (!Array.isArray(input.body.sections)) {
    logBinderSectionParseFailure({
      requestId,
      clientId: input.clientId ?? null,
      adviserUserId: input.adviserUserId ?? null,
      rawSectionIds: [],
      normalizedSectionIds: [],
      rejectedSectionIds: [],
      reason: "invalid_type",
    });
    return {
      ok: false,
      rawSectionIds: [],
      rejectedSectionIds: [],
      reason: "invalid_type",
    };
  }

  const rawSectionIds = input.body.sections.filter(
    (value): value is string => typeof value === "string",
  );
  const { canonical, rejected } = normalizeBinderSectionIds(rawSectionIds);

  if (rejected.length > 0) {
    logBinderSectionParseFailure({
      requestId,
      clientId: input.clientId ?? null,
      adviserUserId: input.adviserUserId ?? null,
      rawSectionIds,
      normalizedSectionIds: canonical,
      rejectedSectionIds: rejected,
      reason: "unknown_section",
    });
    return {
      ok: false,
      rawSectionIds,
      rejectedSectionIds: rejected,
      reason: "unknown_section",
    };
  }

  const sections = buildGenerationSectionList(canonical);

  if (sections.length === 0) {
    logBinderSectionParseFailure({
      requestId,
      clientId: input.clientId ?? null,
      adviserUserId: input.adviserUserId ?? null,
      rawSectionIds,
      normalizedSectionIds: sections,
      rejectedSectionIds: rejected,
      reason: "empty",
    });
    return {
      ok: false,
      rawSectionIds,
      rejectedSectionIds: rejected,
      reason: "empty",
    };
  }

  if (sections.length > BINDER_MAX_SECTION_COUNT) {
    logBinderSectionParseFailure({
      requestId,
      clientId: input.clientId ?? null,
      adviserUserId: input.adviserUserId ?? null,
      rawSectionIds,
      normalizedSectionIds: sections,
      rejectedSectionIds: rejected,
      reason: "too_many",
    });
    return {
      ok: false,
      rawSectionIds,
      rejectedSectionIds: rejected,
      reason: "too_many",
    };
  }

  const contentSectionIds = sections.filter(
    (sectionId) =>
      sectionId !== "cover_page" &&
      sectionId !== "client_adviser_info" &&
      sectionId !== "meeting_date",
  );

  return {
    ok: true,
    sections,
    contentSectionIds,
    rawSectionIds,
    rejectedSectionIds: rejected,
  };
}

function logBinderSectionParseFailure(input: {
  requestId: string;
  clientId: string | null;
  adviserUserId: string | null;
  rawSectionIds: string[];
  normalizedSectionIds: string[];
  rejectedSectionIds: string[];
  reason: string;
}): void {
  logError("binder section parse failed", {
    requestId: input.requestId,
    route: "binder-export",
    stage: "section_validation",
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    rawSectionIds: input.rawSectionIds,
    normalizedSectionIds: input.normalizedSectionIds,
    rejectedSectionIds: input.rejectedSectionIds,
    code: BINDER_ERROR_CODES.INVALID_SECTIONS,
    reason: input.reason,
  });
}

export function binderInvalidSectionsResponse() {
  return {
    ok: false as const,
    error: {
      code: BINDER_ERROR_CODES.INVALID_SECTIONS,
      message: "One or more selected meeting-pack sections are not supported.",
    },
  };
}
