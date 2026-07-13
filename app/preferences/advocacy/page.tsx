import { ClientAdvocacyPreferencesClient } from "@/components/aegis/client/ClientAdvocacyPreferencesClient";
import { assertCrmV2ClientAdvocacyAccess } from "@/lib/crm-v2/access";
import { loadClientAdvocacyPreferences } from "@/lib/crm-v2/advocacy/advocacy";

export default async function ClientAdvocacyPreferencesPage() {
  const access = await assertCrmV2ClientAdvocacyAccess();
  if (!access.allowed) {
    return (
      <ClientAdvocacyPreferencesClient
        initialPreferences={null}
        loadError="Advocacy preferences are not available."
      />
    );
  }

  const preferences = await loadClientAdvocacyPreferences({ clientId: access.client.id });

  return (
    <ClientAdvocacyPreferencesClient initialPreferences={preferences} loadError={null} />
  );
}
