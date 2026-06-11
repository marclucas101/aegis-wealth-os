import type { Metadata } from "next";
import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import PromotionsClient from "@/components/aegis/promotions/PromotionsClient";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Promotions",
};

export default async function PromotionsPage() {
  await cookies();

  return (
    <AppShell
      title="Curated Opportunities"
      subtitle="Selected campaigns and planning opportunities from your advisory team."
    >
      <PromotionsClient />

      <div className="mt-8">
        <ClientTrustNotice variant="compact" context="general" />
      </div>
    </AppShell>
  );
}
