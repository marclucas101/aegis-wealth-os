import AppShell from "@/components/aegis/AppShell";
import WealthBlueprintClient from "@/components/aegis/blueprint/WealthBlueprintClient";

export default function WealthBlueprintPage() {
  return (
    <AppShell
      title="Wealth Blueprint™"
      subtitle="Institutional reports · Architecture diagnostic preview"
    >
      <WealthBlueprintClient />
    </AppShell>
  );
}
