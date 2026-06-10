import { REPORT_DISCLAIMER_PARAGRAPHS } from "@/lib/aegis/legal";

export default function ReportDisclaimer() {
  return (
    <section className="report-print-page-break report-print-avoid-break mt-12 border border-[#10283A]/12 bg-[#F8F7F4] px-6 py-6 sm:px-8">
      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#10283A]/45">
        Important Notice
      </p>
      {REPORT_DISCLAIMER_PARAGRAPHS.map((paragraph) => (
        <p
          key={paragraph.slice(0, 40)}
          className="mt-3 text-sm font-light leading-relaxed text-[#10283A]/75"
        >
          {paragraph}
        </p>
      ))}
      <p className="mt-3 text-xs font-light leading-relaxed text-[#10283A]/55">
        Draft legal template — consult a qualified professional before acting.
        This report is planning-support output, not regulated advice.
      </p>
    </section>
  );
}
