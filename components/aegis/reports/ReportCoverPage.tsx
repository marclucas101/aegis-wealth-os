interface ReportCoverPageProps {
  reportType: string;
  reportTitle: string;
  clientName?: string;
  generatedDate: string;
  subtitle?: string;
  confidential?: boolean;
}

export default function ReportCoverPage({
  reportType,
  reportTitle,
  clientName,
  generatedDate,
  subtitle,
  confidential = true,
}: ReportCoverPageProps) {
  return (
    <div className="report-print-page-break report-print-avoid-break mb-12 flex min-h-[70vh] flex-col justify-between border border-[#D1A866]/30 bg-white px-8 py-12 sm:px-12 sm:py-16">
      <div>
        <div className="h-px w-16 bg-[#D1A866]" />
        <p className="mt-8 text-[10px] font-medium uppercase tracking-[0.35em] text-[#10283A]/50">
          AEGIS Wealth Operating System™
        </p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-[#D1A866]">
          {reportType}
        </p>
        <h1 className="mt-4 text-3xl font-light tracking-wide text-[#10283A] sm:text-4xl">
          {reportTitle}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-lg text-sm font-light leading-relaxed text-[#10283A]/60">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="mt-16 grid gap-8 border-t border-[#10283A]/10 pt-10 sm:grid-cols-2">
        {clientName ? (
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#10283A]/40">
              Prepared For
            </p>
            <p className="mt-2 text-lg font-light text-[#10283A]">
              {clientName}
            </p>
          </div>
        ) : null}

        <div className={clientName ? "" : "sm:col-span-2"}>
          <p className="text-[9px] uppercase tracking-[0.18em] text-[#10283A]/40">
            Report Date
          </p>
          <p className="mt-2 text-lg font-light text-[#10283A]/80">
            {generatedDate}
          </p>
        </div>
      </div>

      {confidential ? (
        <p className="mt-12 text-[9px] uppercase tracking-[0.2em] text-[#10283A]/35">
          Confidential · For planning review with a qualified advisor
        </p>
      ) : null}
    </div>
  );
}
