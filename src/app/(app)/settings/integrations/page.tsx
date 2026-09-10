import { requireAppUser } from "@/lib/auth";
import { listIntegrations } from "@/lib/actions/integrations";
import { IntegrationCard } from "@/components/settings/integration-card";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations";

export default async function IntegrationsPage() {
  const appUser = await requireAppUser();
  const integrations = await listIntegrations();
  const canManage = appUser.role === "owner" || appUser.role === "admin";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {INTEGRATION_PROVIDERS.map((provider) => (
        <IntegrationCard
          key={provider.provider}
          provider={provider}
          row={integrations.find((i) => i.provider === provider.provider)}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
