"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export type SavedViewEntityType = "contact" | "deal";

function pathForEntityType(entityType: SavedViewEntityType) {
  return entityType === "deal" ? "/pipeline" : "/contacts";
}

export async function listSavedViews(entityType: SavedViewEntityType = "contact") {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("saved_views").select("*").eq("entity_type", entityType).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSavedView(input: { name: string; isShared: boolean; filters: Record<string, string>; entityType?: SavedViewEntityType }) {
  if (!input.name.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();
  const entityType = input.entityType ?? "contact";

  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      organization_id: appUser.organization_id!,
      entity_type: entityType,
      name: input.name.trim(),
      created_by: appUser.id,
      is_shared: input.isShared,
      filters: input.filters,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath(pathForEntityType(entityType));
  return data.id as string;
}

export async function deleteSavedView(viewId: string, entityType: SavedViewEntityType = "contact") {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("saved_views").delete().eq("id", viewId);
  if (error) throw error;

  revalidatePath(pathForEntityType(entityType));
}
