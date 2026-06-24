import { redirect } from "next/navigation";

import {
  auditLegacyPromotionsRetirementAccess,
  adviserPromotionsRetiredRedirectTarget,
} from "@/lib/promotions/legacyPromotionsRetirement";
import {
  resolveLegacyPromotionViewerRole,
} from "@/lib/promotions/legacyPromotionsAuthorization";
import { isAdvisorRole, requireAuthenticatedUser } from "@/lib/supabase/authGuards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdvisorPromotionsRetiredRedirectPage() {
  const auth = await requireAuthenticatedUser();

  if (auth.authenticated && isAdvisorRole(auth.user.role)) {
    const role = resolveLegacyPromotionViewerRole(auth.user.role);
    if (role) {
      await auditLegacyPromotionsRetirementAccess({
        userId: auth.authUser.id,
        role,
        routeCategory: "advisor_page",
      });
    }
  }

  redirect(adviserPromotionsRetiredRedirectTarget());
}
