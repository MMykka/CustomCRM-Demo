"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function listSavedViews() {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("saved_views").select("*").eq("entity_type", "contact").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSavedView(input: { name: string; isShared: boolean; filters: Record<string, string> }) {
  if (!input.name.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      organization_id: appUser.organization_id!,
      entity_type: "contact",
      name: input.name.trim(),
      created_by: appUser.id,
      is_shared: input.isShared,
      filters: input.filters,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/contacts");
  return data.id as string;
}

export async function deleteSavedView(viewId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("saved_views").delete().eq("id", viewId);
  if (error) throw error;

  revalidatePath("/contacts");
}
