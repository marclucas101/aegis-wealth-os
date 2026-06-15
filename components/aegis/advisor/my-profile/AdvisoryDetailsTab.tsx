"use client";

import type { AdviserProfileFormData } from "@/lib/aegis/myAdviser";

import {
  InlineMessage,
  SaveBar,
  SectionCard,
  fieldInputClass,
  fieldLabelClass,
  type SaveState,
} from "./myProfileUi";

const SUGGESTED_INSURERS = [
  "Prudential",
  "AIA",
  "Great Eastern",
  "Income Insurance",
  "Manulife",
  "Singlife",
  "Other",
];

export default function AdvisoryDetailsTab({
  form,
  loading,
  loadError,
  saveState,
  saveError,
  dirty,
  onChange,
  onSave,
}: {
  form: AdviserProfileFormData;
  loading: boolean;
  loadError: string | null;
  saveState: SaveState;
  saveError: string | null;
  dirty: boolean;
  onChange: (patch: Partial<AdviserProfileFormData>) => void;
  onSave: () => void;
}) {
  if (loading) {
    return (
      <div className="h-64 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (loadError) {
    return <InlineMessage tone="error">{loadError}</InlineMessage>;
  }

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Advisory details"
        description="Contact and professional presentation shown to your assigned clients."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabelClass}>Phone number</span>
            <input
              value={form.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
              className={fieldInputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass}>Organisation</span>
            <input
              value={form.organisation}
              onChange={(event) => onChange({ organisation: event.target.value })}
              className={fieldInputClass}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className={fieldLabelClass}>Representing insurer</span>
            <input
              list="advisory-insurer-suggestions"
              value={form.representingInsurer}
              onChange={(event) =>
                onChange({ representingInsurer: event.target.value })
              }
              className={fieldInputClass}
            />
            <datalist id="advisory-insurer-suggestions">
              {SUGGESTED_INSURERS.map((insurer) => (
                <option key={insurer} value={insurer} />
              ))}
            </datalist>
          </label>
        </div>

        <SaveBar
          state={saveState}
          errorMessage={saveError}
          dirty={dirty}
          onSave={onSave}
          label="Save advisory details"
        />
      </SectionCard>
    </div>
  );
}
