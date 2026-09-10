"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, requireOrgRole } from "@/lib/auth";
import type { WebhookEventType } from "@/lib/types";

export async function listWebhookEndpoints() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createWebhookEndpoint(input: { url: string; description: string; events: WebhookEventType[] }) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.from("webhook_endpoints").insert({
    organization_id: appUser.organization_id!,
    url: input.url,
    description: input.description || null,
    events: input.events,
    secret: randomUUID(),
    created_by: appUser.id,
  });

  if (error) throw error;
  revalidatePath("/settings/api-keys");
}

export async function updateWebhookEndpoint(
  endpointId: string,
  input: { url: string; description: string; events: WebhookEventType[]; isActive: boolean },
) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("webhook_endpoints")
    .update({ url: input.url, description: input.description || null, events: input.events, is_active: input.isActive })
    .eq("id", endpointId);

  if (error) throw error;
  revalidatePath("/settings/api-keys");
}

export async function deleteWebhookEndpoint(endpointId: string) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.from("webhook_endpoints").delete().eq("id", endpointId);
  if (error) throw error;

  revalidatePath("/settings/api-keys");
}

export async function listWebhookDeliveries(endpointId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("webhook_endpoint_id", endpointId)
    .order("attempted_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}
