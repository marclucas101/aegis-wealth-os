import AppShell from "@/components/aegis/AppShell";
import WealthBlueprintClient from "@/components/aegis/blueprint/WealthBlueprintClient";

export default function WealthBlueprintPage() {
  return (
    <AppShell
      title="Wealth Blueprint™"
      subtitle="Your personal planning report"
    >
      <WealthBlueprintClient />
    </AppShell>
  );
}
