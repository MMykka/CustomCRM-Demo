"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function listTagsWithUsage() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("*, contact_tags(count)")
    .eq("organization_id", appUser.organization_id!)
    .order("name");

  if (error) throw error;
  return (data ?? []).map((tag) => ({ ...tag, usageCount: tag.contact_tags[0]?.count ?? 0 }));
}

export async function createTag(name: string, color: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tags").insert({ organization_id: appUser.organization_id!, name, color });
  if (error) throw error;

  revalidatePath("/settings/tags");
}

export async function renameTag(tagId: string, name: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tags").update({ name }).eq("id", tagId);
  if (error) throw error;

  revalidatePath("/settings/tags");
}

export async function updateTagColor(tagId: string, color: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tags").update({ color }).eq("id", tagId);
  if (error) throw error;

  revalidatePath("/settings/tags");
}

export async function deleteTag(tagId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw error;

  revalidatePath("/settings/tags");
}
