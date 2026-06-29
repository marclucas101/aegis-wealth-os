import CrmV2FoundationEmptyState from "@/components/aegis/advisor-v2/CrmV2FoundationEmptyState";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";

interface CrmV2FoundationPlaceholderPageProps {
  title: string;
  phase: string;
  message: string;
}

export default function CrmV2FoundationPlaceholderPage({
  title,
  phase,
  message,
}: CrmV2FoundationPlaceholderPageProps) {
  return (
    <>
      <CrmV2PageHeader title={title} phase={phase} />
      <CrmV2FoundationEmptyState
        moduleName={title}
        phase={phase}
        message={message}
      />
    </>
  );
}
