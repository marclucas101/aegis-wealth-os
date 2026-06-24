import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  auditLegacyPromotionsRetirementAccess,
  clientPromotionsRetiredRedirectTarget,
} from "@/lib/promotions/legacyPromotionsRetirement";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientPromotionsRetiredRedirectPage() {
  await cookies();

  const session = await ensureUserClientProfile();
  if (session.authenticated && session.user.role === "client") {
    await auditLegacyPromotionsRetirementAccess({
      userId: session.user.id,
      role: session.user.role,
      routeCategory: "client_page",
    });
  }

  redirect(clientPromotionsRetiredRedirectTarget());
}
