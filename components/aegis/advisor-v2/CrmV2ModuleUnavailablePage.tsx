import CrmV2FoundationEmptyState from "@/components/aegis/advisor-v2/CrmV2FoundationEmptyState";
import CrmV2PageHeader from "@/components/aegis/advisor-v2/CrmV2PageHeader";
import type { CrmV2AccessDeniedReason } from "@/lib/crm-v2/access";
import { crmV2ModuleUnavailableMessage } from "@/lib/crm-v2/modulePlaceholder";

interface CrmV2ModuleUnavailablePageProps {
  title: string;
  reason: CrmV2AccessDeniedReason;
  nextStep?: string;
}

export default function CrmV2ModuleUnavailablePage({
  title,
  reason,
  nextStep,
}: CrmV2ModuleUnavailablePageProps) {
  return (
    <>
      <CrmV2PageHeader title={title} />
      <CrmV2FoundationEmptyState
        moduleName={title}
        message={crmV2ModuleUnavailableMessage(title, reason)}
        nextStep={nextStep}
        variant="unavailable"
      />
    </>
  );
}
