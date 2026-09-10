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

export async function listSequencesForSettings() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequences")
    .select("*, sequence_steps(count)")
    .eq("organization_id", appUser.organization_id!)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((seq) => ({ ...seq, stepCount: seq.sequence_steps[0]?.count ?? 0 }));
}

export async function createSequence(name: string, description: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequences").insert({
    organization_id: appUser.organization_id!,
    name,
    description: description || null,
  });

  if (error) throw error;
  revalidatePath("/settings/sequences");
}

export async function renameSequence(sequenceId: string, name: string, description: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequences").update({ name, description: description || null }).eq("id", sequenceId);
  if (error) throw error;

  revalidatePath("/settings/sequences");
}

export async function toggleSequenceActive(sequenceId: string, isActive: boolean) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequences").update({ is_active: isActive }).eq("id", sequenceId);
  if (error) throw error;

  revalidatePath("/settings/sequences");
}

export async function deleteSequence(sequenceId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("sequences").delete().eq("id", sequenceId);
  if (error) throw error;

  revalidatePath("/settings/sequences");
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
