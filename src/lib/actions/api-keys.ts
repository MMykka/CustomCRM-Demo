"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, requireOrgRole } from "@/lib/auth";

export async function listApiKeys() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createApiKey(name: string): Promise<{ plaintextKey: string }> {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const plaintextKey = `hub_live_${randomUUID().replace(/-/g, "")}`;
  const keyHash = createHash("sha256").update(plaintextKey).digest("hex");

  const { error } = await supabase.from("api_keys").insert({
    organization_id: appUser.organization_id!,
    name,
    key_prefix: plaintextKey.slice(0, 12),
    key_hash: keyHash,
    created_by: appUser.id,
  });

  if (error) throw error;

  revalidatePath("/settings/api-keys");
  return { plaintextKey };
}

export async function revokeApiKey(keyId: string) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId);
  if (error) throw error;

  revalidatePath("/settings/api-keys");
}
