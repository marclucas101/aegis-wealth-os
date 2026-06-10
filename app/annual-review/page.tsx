import AppShell from "@/components/aegis/AppShell";
import AnnualReviewClient from "@/components/aegis/annual/AnnualReviewClient";

export default function AnnualReviewPage() {
  return (
    <AppShell
      title="Annual Shield Review™"
      subtitle="What changed · What to focus on next"
    >
      <AnnualReviewClient />
    </AppShell>
  );
}
