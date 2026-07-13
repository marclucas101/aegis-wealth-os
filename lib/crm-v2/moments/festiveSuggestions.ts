import "server-only";

import { assertEthnicityUseAllowed } from "@/lib/crm-v2/moments/sensitivity";
import type { CrmClientEthnicity } from "@/lib/crm-v2/moments/types";
import { createCrmMomentsAdmin } from "@/lib/crm-v2/moments/db";

export type FestiveHolidayMapping = {
  holidayKey: string;
  displayName: string;
  ethnicityKeys: string[];
  typicalMonth: number | null;
  typicalDay: number | null;
  lunarCalendar: boolean;
};

export async function loadFestiveHolidayMappings(): Promise<FestiveHolidayMapping[]> {
  const admin = createCrmMomentsAdmin();
  const { data } = await admin
    .from("festive_holiday_mappings")
    .select("holiday_key, display_name, ethnicity_keys, typical_month, typical_day, lunar_calendar")
    .eq("active", true);

  return (data ?? []).map((row) => ({
    holidayKey: String(row.holiday_key),
    displayName: String(row.display_name),
    ethnicityKeys: (row.ethnicity_keys as string[]) ?? [],
    typicalMonth: row.typical_month ? Number(row.typical_month) : null,
    typicalDay: row.typical_day ? Number(row.typical_day) : null,
    lunarCalendar: Boolean(row.lunar_calendar),
  }));
}

export async function loadFestiveSuggestionsForClient(input: {
  clientId: string;
  adviserUserId: string;
  ethnicity: CrmClientEthnicity | null;
}): Promise<
  Array<{
    holidayKey: string;
    displayName: string;
    suggestedDate: string | null;
    overrideAction: "include" | "exclude" | null;
  }>
> {
  assertEthnicityUseAllowed("festive_suggestion");
  if (!input.ethnicity || input.ethnicity === "prefer_not_to_say") {
    return [];
  }

  const admin = createCrmMomentsAdmin();
  const [mappings, overridesResult] = await Promise.all([
    loadFestiveHolidayMappings(),
    admin
      .from("adviser_moment_overrides")
      .select("holiday_key, override_action")
      .eq("client_id", input.clientId)
      .eq("adviser_user_id", input.adviserUserId),
  ]);

  const overrides = new Map(
    (overridesResult.data ?? []).map((row) => [
      String(row.holiday_key),
      String(row.override_action) as "include" | "exclude",
    ]),
  );

  const suggestions: Array<{
    holidayKey: string;
    displayName: string;
    suggestedDate: string | null;
    overrideAction: "include" | "exclude" | null;
  }> = [];

  for (const mapping of mappings) {
    const override = overrides.get(mapping.holidayKey);
    if (override === "exclude") continue;

    const ethnicityMatch = mapping.ethnicityKeys.includes(input.ethnicity);
    if (!ethnicityMatch && override !== "include") continue;

    let suggestedDate: string | null = null;
    if (mapping.typicalMonth && mapping.typicalDay && !mapping.lunarCalendar) {
      const year = new Date().getFullYear();
      suggestedDate = `${year}-${String(mapping.typicalMonth).padStart(2, "0")}-${String(mapping.typicalDay).padStart(2, "0")}`;
    }

    suggestions.push({
      holidayKey: mapping.holidayKey,
      displayName: mapping.displayName,
      suggestedDate,
      overrideAction: override ?? null,
    });
  }

  return suggestions;
}
