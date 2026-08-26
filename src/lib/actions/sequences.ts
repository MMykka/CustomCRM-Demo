"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function listSequencesForPicker() {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("sequences").select("id, name").eq("is_active", true).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function enrollContactInSequence(contactId: string, sequenceId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequence_enrollments").insert({
    organization_id: appUser.organization_id!,
    contact_id: contactId,
    sequence_id: sequenceId,
  });

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function pauseSequenceEnrollment(enrollmentId: string, contactId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequence_enrollments").update({ status: "paused" }).eq("id", enrollmentId);
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function resumeSequenceEnrollment(enrollmentId: string, contactId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequence_enrollments").update({ status: "active" }).eq("id", enrollmentId);
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function removeSequenceEnrollment(enrollmentId: string, contactId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({ status: "exited", completed_at: new Date().toISOString() })
    .eq("id", enrollmentId);
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}
