import { ClientProtectionClient } from "@/components/aegis/client/ClientProtectionClient";
import { assertCrmV2ClientProtectionAccess } from "@/lib/crm-v2/access";
import {
  getClientProtectionPolicyDetail,
  loadClientProtectionPortfolio,
} from "@/lib/crm-v2/protection/protection";

type PageProps = {
  params: Promise<{ policyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientProtectionDetailPage({ params, searchParams }: PageProps) {
  const { policyId } = await params;
  const query = await searchParams;
  const action = typeof query.action === "string" ? query.action : undefined;
  const access = await assertCrmV2ClientProtectionAccess();

  if (!access.allowed) {
    return (
      <ClientProtectionClient
        initialPortfolio={null}
        initialDetail={null}
        loadError="Protection summary is not available."
      />
    );
  }

  const [portfolio, detailResult] = await Promise.all([
    loadClientProtectionPortfolio({ clientId: access.client.id }),
    getClientProtectionPolicyDetail({ clientId: access.client.id, policyId }),
  ]);

  return (
    <ClientProtectionClient
      initialPortfolio={portfolio}
      initialDetail={detailResult.ok ? detailResult.data : null}
      policyId={policyId}
      showCorrection={action === "correction"}
      loadError={detailResult.ok ? null : "Policy not found."}
    />
  );
}
