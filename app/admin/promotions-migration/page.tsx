import PromotionsMigrationReviewClient from "@/components/aegis/admin/PromotionsMigrationReviewClient";
import AuthenticatedAppShell from "@/components/aegis/AuthenticatedAppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPromotionsMigrationPage() {
  return (
    <AuthenticatedAppShell
      title="Legacy Promotions Migration"
      subtitle="Review historical promotions and transfer approved records into Governed Communications as unpublished drafts."
    >
      <PromotionsMigrationReviewClient />
    </AuthenticatedAppShell>
  );
}
