"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function switchOrganization(organizationId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("switch_active_organization", { target_org_id: organizationId });
  if (error) throw error;

  revalidatePath("/", "layout");
  redirect("/contacts");
}

export async function listOrgMembersForPicker() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email")
    .eq("organization_id", appUser.organization_id!)
    .order("full_name");

  if (error) throw error;
  return data ?? [];
}

export async function renameOrganization(_prevState: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Organization name is required" };

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("organizations").update({ name }).eq("id", appUser.organization_id!);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { error: null };
}

export type BusinessHours = Record<string, { start: string; end: string } | null>;

export async function updateOrgProfile(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const timezone = String(formData.get("timezone") ?? "UTC");
  const businessHoursRaw = String(formData.get("businessHours") ?? "null");
  const quietHoursRaw = String(formData.get("quietHours") ?? "null");

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("organizations")
    .update({
      timezone,
      business_hours: JSON.parse(businessHoursRaw),
      quiet_hours: JSON.parse(quietHoursRaw),
    })
    .eq("id", appUser.organization_id!);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { error: null };
}

export async function updateOrgLogo(input: { storagePath: string }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data } = supabase.storage.from("org-logos").getPublicUrl(input.storagePath);

  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: data.publicUrl })
    .eq("id", appUser.organization_id!);

  if (error) throw error;

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
