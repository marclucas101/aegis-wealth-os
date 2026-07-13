interface CrmV2PageHeaderProps {
  title: string;
  subtitle?: string;
  phase?: string;
}

export default function CrmV2PageHeader({
  title,
  subtitle,
  phase,
}: CrmV2PageHeaderProps) {
  return (
    <header className="mb-8 border-b border-[#D1A866]/12 pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/75">
          AEGIS Adviser Workspace
        </p>
        {phase ? (
          <span className="rounded-sm border border-[#D1A866]/20 bg-[#D1A866]/8 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[#D1A866]/80">
            {phase}
          </span>
        ) : null}
      </div>
      <h1 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-3xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
