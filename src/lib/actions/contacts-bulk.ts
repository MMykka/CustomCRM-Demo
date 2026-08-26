"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { parseContactsFilters, queryContacts } from "@/lib/contacts-query";
import type { LifecycleStage } from "@/lib/types";

export async function bulkTagContacts(contactIds: string[], tagId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contact_tags")
    .upsert(
      contactIds.map((contactId) => ({ contact_id: contactId, tag_id: tagId, organization_id: appUser.organization_id! })),
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
    );

  if (error) throw error;
  revalidatePath("/contacts");
}

export async function bulkAssignOwner(contactIds: string[], ownerId: string | null) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("contacts").update({ owner_id: ownerId }).in("id", contactIds);
  if (error) throw error;

  revalidatePath("/contacts");
}

export async function bulkChangeLifecycleStage(contactIds: string[], stage: LifecycleStage) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("contacts").update({ lifecycle_stage: stage }).in("id", contactIds);
  if (error) throw error;

  revalidatePath("/contacts");
}

export async function bulkEnrollInSequence(contactIds: string[], sequenceId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  // Skip contacts already actively enrolled in this sequence, so the
  // batch insert doesn't fail whole-hog on sequence_enrollments_active_unique_idx.
  const { data: existing } = await supabase
    .from("sequence_enrollments")
    .select("contact_id")
    .eq("sequence_id", sequenceId)
    .eq("status", "active")
    .in("contact_id", contactIds);

  const alreadyEnrolled = new Set((existing ?? []).map((e) => e.contact_id));
  const toEnroll = contactIds.filter((id) => !alreadyEnrolled.has(id));
  if (toEnroll.length === 0) return { enrolled: 0, skipped: contactIds.length };

  const { error } = await supabase.from("sequence_enrollments").insert(
    toEnroll.map((contactId) => ({
      organization_id: appUser.organization_id!,
      contact_id: contactId,
      sequence_id: sequenceId,
    })),
  );
  if (error) throw error;

  revalidatePath("/contacts");
  return { enrolled: toEnroll.length, skipped: alreadyEnrolled.size };
}

export async function bulkDeleteContacts(contactIds: string[]) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("contacts").delete().in("id", contactIds);
  if (error) throw error;

  revalidatePath("/contacts");
}

const EXPORT_ROW_CAP = 10000;

export async function exportContactsForFilters(searchParams: Record<string, string>) {
  await requireAppUser();
  const supabase = await createClient();

  const filters = parseContactsFilters(searchParams);
  const { rows } = await queryContacts(supabase, { ...filters, page: 1 }, EXPORT_ROW_CAP);
  return rows.map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone,
    job_title: c.job_title,
    source: c.source,
    lifecycle_stage: c.lifecycle_stage,
    lead_score: c.lead_score,
    company: c.company?.name ?? "",
    owner: c.owner?.full_name ?? c.owner?.email ?? "",
    tags: c.contact_tags.map((ct) => ct.tags?.name).filter(Boolean).join(";"),
    created_at: c.created_at,
  }));
}
