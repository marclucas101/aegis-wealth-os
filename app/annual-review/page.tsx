import { cookies } from "next/headers";

import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";
import AnnualReviewClient from "@/components/aegis/annual/AnnualReviewClient";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnnualReviewPage() {
  await cookies();

  return (
    <AuthenticatedAppShell
      title="Annual Shield Review™"
      subtitle="What changed · What to focus on next"
    >
      <AnnualReviewClient />
    </AuthenticatedAppShell>
  );
}
