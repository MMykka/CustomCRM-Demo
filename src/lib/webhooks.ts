import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { WebhookEventType } from "@/lib/types";

// Delivers an event to every active org-configured webhook endpoint
// (Settings -> API Keys -> Webhooks) subscribed to it, and records each
// attempt in webhook_deliveries. Distinct from the hardcoded env-var n8n
// calls in src/lib/n8n.ts.
//
// Receivers verify authenticity with the X-Hub-Signature header:
// "sha256=" + hex HMAC-SHA256 of `${X-Hub-Timestamp}.${rawBody}` keyed by the
// endpoint's secret.
//
// Best-effort and slow-ish (one HTTP call per endpoint, 5s timeout each):
// run it from next/server's after() so it never delays the API response.
export async function dispatchWebhookEvent(organizationId: string, event: WebhookEventType, data: Record<string, unknown>) {
  const endpoints = await subscribedEndpoints(organizationId, [event]);
  await deliver(organizationId, endpoints, event, data);
}

/** Endpoints subscribed to any of `events`; callers can skip building payloads when this is empty. */
export async function subscribedEndpoints(organizationId: string, events: WebhookEventType[]) {
  const { data, error } = await createAdminClient()
    .from("webhook_endpoints")
    .select("id, url, secret, events")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .overlaps("events", events);

  if (error) {
    console.error("Failed to load webhook endpoints", error);
    return [];
  }
  return data ?? [];
}

export async function deliver(
  organizationId: string,
  allEndpoints: Awaited<ReturnType<typeof subscribedEndpoints>>,
  event: WebhookEventType,
  data: Record<string, unknown>,
) {
  const endpoints = allEndpoints.filter((e) => e.events.includes(event));
  if (!endpoints.length) return;

  const supabase = createAdminClient();
  const payload = { id: `evt_${randomUUID().replace(/-/g, "")}`, event, created_at: new Date().toISOString(), organization_id: organizationId, data };
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  await Promise.all(
    endpoints.map(async (endpoint) => {
      const signature = createHmac("sha256", endpoint.secret).update(`${timestamp}.${body}`).digest("hex");
      let responseStatus: number | null = null;
      let ok = false;
      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "TheHub-Webhooks/1.0",
            "X-Hub-Event": event,
            "X-Hub-Delivery": payload.id,
            "X-Hub-Timestamp": timestamp,
            "X-Hub-Signature": `sha256=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        responseStatus = res.status;
        ok = res.ok;
      } catch (err) {
        console.error(`Webhook delivery to ${endpoint.url} failed`, err);
      }

      await supabase.from("webhook_deliveries").insert({
        webhook_endpoint_id: endpoint.id,
        organization_id: organizationId,
        event_type: event,
        payload: payload as unknown as Json,
        status: ok ? "success" : "failed",
        response_status: responseStatus,
      });
    }),
  );
}
