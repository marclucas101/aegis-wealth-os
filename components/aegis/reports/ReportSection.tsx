import type { ReactNode } from "react";

interface ReportSectionProps {
  label?: string;
  title: string;
  description?: string;
  children: ReactNode;
  pageBreakBefore?: boolean;
}

export default function ReportSection({
  label,
  title,
  description,
  children,
  pageBreakBefore = false,
}: ReportSectionProps) {
  return (
    <section
      className={`report-print-avoid-break mb-10 ${pageBreakBefore ? "report-print-page-break" : ""}`}
    >
      <div className="mb-5 border-b border-[#10283A]/12 pb-3">
        {label ? (
          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#D1A866]">
            {label}
          </p>
        ) : null}
        <h2 className="mt-1 text-lg font-light tracking-wide text-[#10283A]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs font-light text-[#10283A]/55">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
