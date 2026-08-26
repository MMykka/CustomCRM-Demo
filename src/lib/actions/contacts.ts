"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { contactDisplayName, type LifecycleStage } from "@/lib/types";

export async function listContactsForPicker() {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).map((c) => ({ id: c.id, label: contactDisplayName(c) }));
}

export async function addContact(input: { firstName: string; lastName: string; email: string; phone: string }) {
  if (!input.firstName.trim() && !input.lastName.trim() && !input.email.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: appUser.organization_id!,
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      owner_id: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/contacts");
  return data.id as string;
}

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

export async function updateContact(
  contactId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    jobTitle: string;
    source: string;
    lifecycleStage: LifecycleStage;
    leadScore: number;
    companyId: string | null;
    ownerId: string | null;
  },
) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      first_name: input.firstName.trim() || null,
      last_name: input.lastName.trim() || null,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      job_title: input.jobTitle.trim() || null,
      source: input.source.trim() || null,
      lifecycle_stage: input.lifecycleStage,
      lead_score: input.leadScore,
      company_id: input.companyId,
      owner_id: input.ownerId,
    })
    .eq("id", contactId);

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
}

export async function listCompaniesForPicker() {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("companies").select("id, name").order("name").limit(200);

  if (error) throw error;
  return data ?? [];
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
