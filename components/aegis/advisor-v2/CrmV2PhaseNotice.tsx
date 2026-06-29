interface CrmV2PhaseNoticeProps {
  phase: string;
  message: string;
}

export default function CrmV2PhaseNotice({ phase, message }: CrmV2PhaseNoticeProps) {
  return (
    <div
      className="rounded-sm border border-[#D1A866]/18 bg-[#1A2A2B]/40 px-4 py-3"
      role="status"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
        Foundation · {phase}
      </p>
      <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/55">
        {message}
      </p>
    </div>
  );
}
