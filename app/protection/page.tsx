import { ClientProtectionClient } from "@/components/aegis/client/ClientProtectionClient";
import { assertCrmV2ClientProtectionAccess } from "@/lib/crm-v2/access";
import { loadClientProtectionPortfolio } from "@/lib/crm-v2/protection/protection";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientProtectionPage({ searchParams }: PageProps) {
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

  const portfolio = await loadClientProtectionPortfolio({ clientId: access.client.id });

  return (
    <ClientProtectionClient
      initialPortfolio={portfolio}
      initialDetail={null}
      showCorrection={action === "correction"}
      loadError={null}
    />
  );
}
