"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { runBrowserPrint } from "@/lib/reports/a4Print";

interface ReportPrintShellProps {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  autoPrint?: boolean;
  documentTitle?: string;
}

export default function ReportPrintShell({
  children,
  backHref,
  backLabel = "Back to report",
  autoPrint = false,
  documentTitle,
}: ReportPrintShellProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    await runBrowserPrint({ documentTitle });
    setPrinting(false);
  }, [documentTitle, printing]);

  useEffect(() => {
    if (!autoPrint) return;

    const timer = window.setTimeout(() => {
      void handlePrint();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [autoPrint, handlePrint]);

  return (
    <div className="report-print-root min-h-screen bg-[#ECEAE4] text-[#171717]">
      <div className="report-no-print sticky top-0 z-10 border-b border-[#D1A866]/25 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-6 py-3">
          {backHref ? (
            <Link
              href={backHref}
              className="text-xs uppercase tracking-[0.12em] text-[#10283A]/60 transition hover:text-[#10283A]"
            >
              ← {backLabel}
            </Link>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => void handlePrint()}
            disabled={printing}
            className="inline-flex items-center gap-2 rounded-sm border border-[#10283A]/20 bg-[#10283A] px-5 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white transition hover:bg-[#1A2A2B] disabled:cursor-wait disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              aria-hidden
            >
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {printing ? "Preparing…" : "Print / Save PDF"}
          </button>
        </div>
      </div>

      <main className="report-print-body report-a4-document py-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
