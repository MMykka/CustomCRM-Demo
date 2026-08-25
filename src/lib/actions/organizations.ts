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
