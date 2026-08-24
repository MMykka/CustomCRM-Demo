"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function toggleTaskComplete(taskId: string, completed: boolean) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      status: completed ? "completed" : "open",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) throw error;

  revalidatePath("/tasks");
  revalidatePath("/contacts", "layout");
}

export async function addTask(input: { title: string; dueAt: string | null; contactId?: string; dealId?: string }) {
  if (!input.title.trim()) return;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    organization_id: appUser.organization_id!,
    title: input.title.trim(),
    due_at: input.dueAt,
    contact_id: input.contactId ?? null,
    deal_id: input.dealId ?? null,
    assigned_to: appUser.id,
    created_by: appUser.id,
  });

  if (error) throw error;

  revalidatePath("/tasks");
  if (input.contactId) revalidatePath(`/contacts/${input.contactId}`);
}
