import { cookies } from "next/headers";

import AppShell from "@/components/aegis/AppShell";
import AnnualReviewClient from "@/components/aegis/annual/AnnualReviewClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnnualReviewPage() {
  await cookies();

  return (
    <AppShell
      title="Annual Shield Review™"
      subtitle="What changed · What to focus on next"
    >
      <AnnualReviewClient />
    </AppShell>
  );
}
