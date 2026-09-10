import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysTable } from "@/components/settings/api-keys-table";
import { WebhookEndpointsTable } from "@/components/settings/webhook-endpoints-table";
import { listApiKeys } from "@/lib/actions/api-keys";
import { listWebhookEndpoints } from "@/lib/actions/webhook-endpoints";

export default async function ApiKeysPage() {
  const [apiKeys, webhookEndpoints] = await Promise.all([listApiKeys(), listWebhookEndpoints()]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Credentials for a future public API. Shown in full only once, at creation.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysTable apiKeys={apiKeys} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook endpoints</CardTitle>
          <CardDescription>URLs that get notified when the events you pick happen in this organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookEndpointsTable endpoints={webhookEndpoints} />
        </CardContent>
      </Card>
    </div>
  );
}
