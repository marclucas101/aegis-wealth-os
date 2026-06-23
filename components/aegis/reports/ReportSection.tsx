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
      <div className="report-print-section-heading report-print-keep-with-next mb-5 border-b border-[#10283A]/12 pb-3">
        {label ? (
          <p className="report-section-label text-[#D1A866]">{label}</p>
        ) : null}
        <h2 className="report-title-lg mt-1 text-[#10283A]">{title}</h2>
        {description ? (
          <p className="report-body mt-1 text-[#10283A]/55">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
