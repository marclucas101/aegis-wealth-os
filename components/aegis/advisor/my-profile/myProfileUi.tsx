"use client";

import type { ReactNode } from "react";

import type { CalendarStateDescriptor } from "./myProfileShared";

export const fieldInputClass =
  "mt-1 w-full rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/60 px-3 py-2 text-sm text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/40";

export const fieldLabelClass =
  "text-[10px] uppercase tracking-wider text-[#F3F1EA]/40";

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-5 sm:p-6">
      {eyebrow && (
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="mt-2 text-lg font-light text-[#F3F1EA]">{title}</h2>
      )}
      {description && (
        <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
          {description}
        </p>
      )}
      <div className={eyebrow || title || description ? "mt-6" : ""}>
        {children}
      </div>
    </section>
  );
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveBar({
  state,
  errorMessage,
  dirty,
  onSave,
  label,
  savingLabel = "Saving…",
}: {
  state: SaveState;
  errorMessage?: string | null;
  dirty?: boolean;
  onSave: () => void;
  label: string;
  savingLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={state === "saving"}
        className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "saving" ? savingLabel : label}
      </button>

      {state === "saved" && !dirty && (
        <span className="text-sm font-light text-emerald-300/80">Saved.</span>
      )}
      {state === "error" && (
        <span className="text-sm font-light text-red-300/80">
          {errorMessage ?? "Save failed."}
        </span>
      )}
      {dirty && state !== "saving" && (
        <span className="text-xs font-light text-[#D1A866]/60">
          Unsaved changes
        </span>
      )}
    </div>
  );
}

const TONE_CLASSES: Record<CalendarStateDescriptor["tone"], string> = {
  neutral: "border-[#F3F1EA]/15 bg-[#071B2A]/50 text-[#F3F1EA]/70",
  warning: "border-[#D1A866]/35 bg-[#D1A866]/10 text-[#D1A866]/90",
  success: "border-emerald-400/30 bg-emerald-950/20 text-emerald-200/85",
  danger: "border-red-400/30 bg-red-950/20 text-red-200/85",
};

export function StatusBanner({
  descriptor,
}: {
  descriptor: CalendarStateDescriptor;
}) {
  return (
    <div
      className={`rounded-sm border px-4 py-3 ${TONE_CLASSES[descriptor.tone]}`}
    >
      <p className="text-sm font-medium">{descriptor.label}</p>
      <p className="mt-1 text-xs font-light opacity-80">{descriptor.guidance}</p>
    </div>
  );
}

export function InlineMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-400/30 bg-red-950/20 text-red-200/80"
      : "border-emerald-400/30 bg-emerald-950/20 text-emerald-200/85";
  return (
    <div className={`rounded-sm border px-4 py-3 text-sm font-light ${cls}`}>
      {children}
    </div>
  );
}
