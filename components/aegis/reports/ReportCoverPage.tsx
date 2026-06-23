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
    <div className="report-cover-page report-print-page-break report-print-avoid-break mb-0 flex flex-col justify-between border border-[#D1A866]/30 bg-white">
      <div>
        <div className="h-px w-16 bg-[#D1A866]" />
        <p className="report-type-label mt-8 text-[#10283A]/50">
          AEGIS Wealth Operating System™
        </p>
        <p className="report-section-label mt-3 text-[#D1A866]">{reportType}</p>
        <h1 className="report-title-xl mt-4 text-[#10283A]">{reportTitle}</h1>
        {subtitle ? (
          <p className="report-body mt-3 max-w-[150mm] text-[#10283A]/60">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="mt-12 grid gap-8 border-t border-[#10283A]/10 pt-10 sm:grid-cols-2">
        {clientName ? (
          <div>
            <p className="report-caption uppercase tracking-[0.18em] text-[#10283A]/40">
              Prepared For
            </p>
            <p className="report-title-md mt-2 text-[#10283A]">{clientName}</p>
          </div>
        ) : null}

        <div className={clientName ? "" : "sm:col-span-2"}>
          <p className="report-caption uppercase tracking-[0.18em] text-[#10283A]/40">
            Report Date
          </p>
          <p className="report-title-md mt-2 text-[#10283A]/80">
            {generatedDate}
          </p>
        </div>
      </div>

      {confidential ? (
        <p className="report-caption mt-10 uppercase tracking-[0.2em] text-[#10283A]/35">
          Confidential · For planning review with a qualified advisor
        </p>
      ) : null}
    </div>
  );
}
