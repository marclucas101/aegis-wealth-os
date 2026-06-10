"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  CONSENT_BANNER_STORAGE_KEY,
  DRAFT_LEGAL_WARNING,
  LEGAL_LINKS,
} from "@/lib/aegis/legal";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const dismissed = localStorage.getItem(CONSENT_BANNER_STORAGE_KEY);
        if (!dismissed) {
          setVisible(true);
        }
      } catch {
        setVisible(true);
      }
    });
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(CONSENT_BANNER_STORAGE_KEY, "1");
    } catch {
      // Non-blocking — hide even if storage is unavailable
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-[#D1A866]/20 bg-[#071B2A]/95 px-4 py-4 backdrop-blur-md sm:px-6"
      role="region"
      aria-label="Legal notice"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/80">
            Planning-support platform · Draft legal templates
          </p>
          <p className="mt-1.5 text-xs font-light leading-relaxed text-[#F3F1EA]/55">
            AEGIS provides planning-support tools for advisor-reviewed
            conversations — not standalone financial advice. {DRAFT_LEGAL_WARNING}
          </p>
          <nav
            aria-label="Legal links"
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1"
          >
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[10px] uppercase tracking-[0.14em] text-[#D1A866]/65 underline-offset-2 transition-colors hover:text-[#D1A866] hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 self-start rounded-sm border border-[#D1A866]/30 bg-[#D1A866]/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 sm:self-center"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
