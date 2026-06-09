interface ModulePlaceholderProps {
  moduleName: string;
  description: string;
  features: string[];
  phase?: string;
}

function DecorativeRings() {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-hidden
    >
      <circle
        cx="120"
        cy="120"
        r="100"
        stroke="#D1A866"
        strokeWidth="0.5"
        opacity="0.1"
      />
      <circle
        cx="120"
        cy="120"
        r="76"
        stroke="#D1A866"
        strokeWidth="0.5"
        opacity="0.07"
      />
      <circle
        cx="120"
        cy="120"
        r="52"
        stroke="#D1A866"
        strokeWidth="0.5"
        opacity="0.04"
      />
      <path
        d="M120 36 L168 64 L168 120 C168 150 120 180 120 180 C120 180 72 150 72 120 L72 64 Z"
        stroke="#D1A866"
        strokeWidth="0.6"
        opacity="0.05"
      />
    </svg>
  );
}

export default function ModulePlaceholder({
  moduleName,
  description,
  features,
  phase = "Phase 2",
}: ModulePlaceholderProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 opacity-50 sm:-right-8 sm:h-64 sm:w-64">
        <DecorativeRings />
      </div>

      <div className="relative max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-8 w-px bg-[#D1A866]/50" />
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/80">
            AEGIS Wealth Operating System™
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-sm border border-[#D1A866]/25 bg-[#D1A866]/8 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D1A866]/70" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
              Coming Soon
            </span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/25">
            {phase}
          </span>
        </div>

        <h2 className="text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          {moduleName}
        </h2>

        <p className="mt-4 max-w-2xl text-base font-light leading-relaxed text-[#F3F1EA]/50">
          {description}
        </p>

        <div className="mt-10 rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6 backdrop-blur-sm sm:p-8">
          <p className="mb-5 text-[9px] font-medium uppercase tracking-[0.24em] text-[#F3F1EA]/30">
            Module Architecture
          </p>

          <ul className="space-y-3">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 border-b border-[#D1A866]/6 pb-3 last:border-0 last:pb-0"
              >
                <span
                  className="mt-1.5 h-px w-3 shrink-0 bg-[#D1A866]/40"
                  aria-hidden
                />
                <span className="text-sm font-light leading-relaxed text-[#F3F1EA]/60">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
          Strategic Intelligence · Generational Wealth
        </p>
      </div>
    </div>
  );
}
