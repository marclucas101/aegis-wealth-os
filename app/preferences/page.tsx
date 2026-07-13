import { ClientPreferencesClient } from "@/components/aegis/client/ClientPreferencesClient";
import { assertCrmV2ClientProfileAccess } from "@/lib/crm-v2/access";
import { loadClientRelationshipPreferences } from "@/lib/crm-v2/moments/moments";

export default async function PreferencesPage() {
  const access = await assertCrmV2ClientProfileAccess();
  if (!access.allowed) {
    return (
      <ClientPreferencesClient
        initialPreferences={null}
        loadError="Relationship preferences are not available."
      />
    );
  }

  const preferences = await loadClientRelationshipPreferences({
    clientId: access.client.id,
  });

  return (
    <ClientPreferencesClient initialPreferences={preferences} loadError={null} />
  );
}
