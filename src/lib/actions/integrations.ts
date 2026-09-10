"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, requireOrgRole } from "@/lib/auth";
import { maskValue, type IntegrationProvider } from "@/lib/integrations";

export async function listIntegrations() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", appUser.organization_id!);

  if (error) throw error;

  // Never send raw config values to the client -- mask everything except
  // the last 4 characters.
  return (data ?? []).map((row) => ({
    ...row,
    config: Object.fromEntries(Object.entries(row.config as Record<string, string>).map(([key, value]) => [key, maskValue(value)])),
  }));
}

export async function connectIntegration(provider: IntegrationProvider, config: Record<string, string>) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.from("integrations").upsert(
    {
      organization_id: appUser.organization_id!,
      provider,
      status: "connected",
      config,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,provider" },
  );

  if (error) throw error;
  revalidatePath("/settings/integrations");
}

export async function disconnectIntegration(provider: IntegrationProvider) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("integrations")
    .update({ status: "not_connected", config: {}, connected_at: null })
    .eq("organization_id", appUser.organization_id!)
    .eq("provider", provider);

  if (error) throw error;
  revalidatePath("/settings/integrations");
}
