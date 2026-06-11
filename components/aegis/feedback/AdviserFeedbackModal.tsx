"use client";

import type { ReactNode } from "react";

type AdviserFeedbackModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function AdviserFeedbackModal({
  title,
  subtitle,
  onClose,
  children,
}: AdviserFeedbackModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#071B2A]/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adviser-feedback-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close feedback dialog"
        onClick={onClose}
      />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A] shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

        <div className="flex items-start justify-between gap-4 border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Client care
            </p>
            <h2
              id="adviser-feedback-modal-title"
              className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs font-light text-[#F3F1EA]/40">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-[#D1A866]/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/60 transition hover:border-[#D1A866]/35 hover:text-[#F3F1EA]"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
