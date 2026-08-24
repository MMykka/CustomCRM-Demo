"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function addActivityNote(contactId: string, body: string) {
  if (!body.trim()) return;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("activities").insert({
    organization_id: appUser.organization_id!,
    contact_id: contactId,
    user_id: appUser.id,
    type: "note",
    body: body.trim(),
  });

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function toggleContactTag(contactId: string, tagId: string, add: boolean) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  if (add) {
    const { error } = await supabase
      .from("contact_tags")
      .insert({ contact_id: contactId, tag_id: tagId, organization_id: appUser.organization_id! });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tagId);
    if (error) throw error;
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}
