import { ProtectionPortfolioClient } from "@/components/aegis/advisor-v2/protection/ProtectionPortfolioClient";
import { assertCrmV2ProtectionPortfolioAccess } from "@/lib/crm-v2/access";
import {
  getAdviserProtectionExtraction,
  loadAdviserProtectionPortfolio,
} from "@/lib/crm-v2/protection/protection";
import { parseProtectionWorkspaceView } from "@/lib/crm-v2/protection/routes";

type PageProps = {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProtectionPortfolioPage({ params, searchParams }: PageProps) {
  const { relationshipId } = await params;
  const query = await searchParams;
  const view = parseProtectionWorkspaceView(typeof query.view === "string" ? query.view : undefined);
  const extractionId = typeof query.extractionId === "string" ? query.extractionId : undefined;

  const access = await assertCrmV2ProtectionPortfolioAccess();
  if (!access.allowed) {
    return (
      <ProtectionPortfolioClient
        relationshipId={relationshipId}
        initialView={view}
        initialPortfolio={null}
        initialExtraction={null}
        loadError="Protection portfolio is not available."
      />
    );
  }

  const portfolioResult = await loadAdviserProtectionPortfolio({
    authUserId: access.authUser.id,
    userRole: access.user.role as "advisor" | "admin",
    relationshipId,
  });

  const extractionResult =
    extractionId && portfolioResult.ok
      ? await getAdviserProtectionExtraction({
          authUserId: access.authUser.id,
          userRole: access.user.role as "advisor" | "admin",
          extractionId,
        })
      : null;

  return (
    <ProtectionPortfolioClient
      relationshipId={relationshipId}
      initialView={view}
      initialPortfolio={portfolioResult.ok ? portfolioResult.data : null}
      initialExtraction={extractionResult?.ok ? extractionResult.data : null}
      loadError={portfolioResult.ok ? null : "Unable to load protection portfolio."}
    />
  );
}
