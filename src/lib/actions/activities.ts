"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { CallOutcome } from "@/lib/types";

export async function logCallActivity(contactId: string, input: { outcome: CallOutcome; durationSeconds: number; notes: string }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("activities").insert({
    organization_id: appUser.organization_id!,
    contact_id: contactId,
    user_id: appUser.id,
    type: "call",
    body: input.notes.trim() || null,
    metadata: { outcome: input.outcome, duration_seconds: input.durationSeconds },
  });

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function logMeetingActivity(contactId: string, input: { durationMinutes: number; attendees: string; notes: string }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const attendees = input.attendees
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const { error } = await supabase.from("activities").insert({
    organization_id: appUser.organization_id!,
    contact_id: contactId,
    user_id: appUser.id,
    type: "meeting",
    body: input.notes.trim() || null,
    metadata: { duration_minutes: input.durationMinutes, attendees },
  });

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}
