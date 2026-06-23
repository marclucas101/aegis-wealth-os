import type { BinderPackPurpose } from "@/lib/binder/binderPackPurpose";
import { parseBinderPackPurpose } from "@/lib/binder/binderPackPurpose";
import { selectedContentSectionIds } from "@/lib/binder/binderSectionRegistry";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ParsedBinderReadinessQuery = {
  meetingDate: string | null;
  purpose: BinderPackPurpose;
  selectedSectionIds?: string[];
};

export function parseBinderReadinessQuery(
  searchParams: URLSearchParams,
): { ok: true; query: ParsedBinderReadinessQuery } | { ok: false; message: string } {
  const meetingDateRaw = searchParams.get("meetingDate");
  let meetingDate: string | null = null;

  if (meetingDateRaw !== null) {
    const trimmed = meetingDateRaw.trim();
    if (trimmed.length === 0) {
      meetingDate = null;
    } else if (!ISO_DATE_PATTERN.test(trimmed)) {
      return { ok: false, message: "Choose a valid meeting date." };
    } else {
      const [year, month, day] = trimmed.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) {
        return { ok: false, message: "Choose a valid meeting date." };
      }
      meetingDate = trimmed;
    }
  }

  const purpose = parseBinderPackPurpose(searchParams.get("purpose"));
  const selectedParam = searchParams.get("selectedSections");
  const selectedSectionIds = selectedParam
    ? selectedContentSectionIds(
        selectedParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      )
    : undefined;

  return {
    ok: true,
    query: {
      meetingDate,
      purpose,
      ...(selectedSectionIds && selectedSectionIds.length > 0
        ? { selectedSectionIds }
        : {}),
    },
  };
}
