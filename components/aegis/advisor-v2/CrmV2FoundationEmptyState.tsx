import CrmV2PhaseNotice from "@/components/aegis/advisor-v2/CrmV2PhaseNotice";

interface CrmV2FoundationEmptyStateProps {
  moduleName: string;
  phase: string;
  message: string;
}

export default function CrmV2FoundationEmptyState({
  moduleName,
  phase,
  message,
}: CrmV2FoundationEmptyStateProps) {
  return (
    <div className="max-w-2xl">
      <CrmV2PhaseNotice phase={phase} message={message} />
      <p className="mt-6 text-xs font-light uppercase tracking-[0.14em] text-[#F3F1EA]/25">
        {moduleName} · not yet available
      </p>
    </div>
  );
}
