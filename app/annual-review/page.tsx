import AppShell from "@/components/aegis/AppShell";
import AnnualReviewClient from "@/components/aegis/annual/AnnualReviewClient";

export default function AnnualReviewPage() {
  return (
    <AppShell
      title="Annual Shield Review™"
      subtitle="Architecture progression · Four-year shield timeline"
    >
      <AnnualReviewClient />
    </AppShell>
  );
}
