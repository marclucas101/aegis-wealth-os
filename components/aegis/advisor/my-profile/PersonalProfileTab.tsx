"use client";

import { useRef } from "react";

import type { AdviserProfileFormData } from "@/lib/aegis/myAdviser";

import {
  InlineMessage,
  SaveBar,
  SectionCard,
  fieldInputClass,
  fieldLabelClass,
  type SaveState,
} from "./myProfileUi";

export default function PersonalProfileTab({
  form,
  loading,
  loadError,
  uploading,
  photoError,
  saveState,
  saveError,
  dirty,
  onChange,
  onUploadPhoto,
  onSave,
}: {
  form: AdviserProfileFormData;
  loading: boolean;
  loadError: string | null;
  uploading: boolean;
  photoError: string | null;
  saveState: SaveState;
  saveError: string | null;
  dirty: boolean;
  onChange: (patch: Partial<AdviserProfileFormData>) => void;
  onUploadPhoto: (file: File) => void;
  onSave: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        eyebrow="Public profile"
        description="This information appears on your clients' My Adviser page."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {form.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.photoUrl}
              alt="Your profile photo"
              className="h-24 w-24 rounded-full border border-[#D1A866]/25 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#D1A866]/25 bg-[#10283A] text-[#D1A866]/70">
              {(form.displayName || "A")
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUploadPhoto(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-sm border border-[#D1A866]/35 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/10 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <p className="mt-2 text-[10px] font-light text-[#F3F1EA]/30">
              JPG, PNG, or WebP · max 5 MB
            </p>
            {photoError && (
              <p className="mt-2 text-[11px] font-light text-red-300/80">
                {photoError}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabelClass}>Display name</span>
            <input
              value={form.displayName}
              onChange={(event) => onChange({ displayName: event.target.value })}
              className={fieldInputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass}>Professional title</span>
            <input
              value={form.professionalTitle}
              onChange={(event) =>
                onChange({ professionalTitle: event.target.value })
              }
              className={fieldInputClass}
            />
          </label>

          <label className="block">
            <span className={fieldLabelClass}>Years of experience</span>
            <input
              inputMode="numeric"
              value={form.yearsExperience}
              onChange={(event) =>
                onChange({ yearsExperience: event.target.value })
              }
              className={fieldInputClass}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className={fieldLabelClass}>Short biography</span>
          <textarea
            rows={4}
            value={form.shortBio}
            onChange={(event) => onChange({ shortBio: event.target.value })}
            className={fieldInputClass}
          />
        </label>

        <SaveBar
          state={saveState}
          errorMessage={saveError}
          dirty={dirty}
          onSave={onSave}
          label="Save profile"
        />
      </SectionCard>
    </div>
  );
}
