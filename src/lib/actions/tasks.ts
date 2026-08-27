"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMonths, addWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";
import type { RecurrenceUnit, TaskPriority, TaskType } from "@/lib/types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

function computeNextDueDate(dueAt: string | null, interval: number, unit: RecurrenceUnit): string {
  const anchor = dueAt ? new Date(dueAt) : new Date();
  switch (unit) {
    case "day":
      return addDays(anchor, interval).toISOString();
    case "week":
      return addWeeks(anchor, interval).toISOString();
    case "month":
      return addMonths(anchor, interval).toISOString();
  }
}

function revalidateTaskPaths(row: { contact_id: string | null; deal_id: string | null }) {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/contacts", "layout");
  if (row.contact_id) revalidatePath(`/contacts/${row.contact_id}`);
  if (row.deal_id) revalidatePath(`/pipeline/${row.deal_id}`);
}

export async function toggleTaskComplete(taskId: string, completed: boolean) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("due_at, recurrence_interval, recurrence_unit, title, type, priority, contact_id, deal_id, assigned_to")
    .eq("id", taskId)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("tasks")
    .update({
      status: completed ? "completed" : "open",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) throw error;

  if (completed && existing.recurrence_interval && existing.recurrence_unit) {
    const nextDueAt = computeNextDueDate(existing.due_at, existing.recurrence_interval, existing.recurrence_unit as RecurrenceUnit);
    const { error: insertError } = await supabase.from("tasks").insert({
      organization_id: appUser.organization_id!,
      title: existing.title,
      type: existing.type,
      priority: existing.priority,
      due_at: nextDueAt,
      contact_id: existing.contact_id,
      deal_id: existing.deal_id,
      assigned_to: existing.assigned_to,
      created_by: appUser.id,
      recurrence_interval: existing.recurrence_interval,
      recurrence_unit: existing.recurrence_unit,
    });
    if (insertError) throw insertError;
  }

  revalidateTaskPaths(existing);
}

export async function addTask(input: {
  title: string;
  dueAt: string | null;
  contactId?: string;
  dealId?: string;
  type?: TaskType;
  recurrenceInterval?: number | null;
  recurrenceUnit?: RecurrenceUnit | null;
}) {
  if (!input.title.trim()) return;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    organization_id: appUser.organization_id!,
    title: input.title.trim(),
    due_at: input.dueAt,
    contact_id: input.contactId ?? null,
    deal_id: input.dealId ?? null,
    type: input.type ?? "task",
    recurrence_interval: input.recurrenceInterval ?? null,
    recurrence_unit: input.recurrenceUnit ?? null,
    assigned_to: appUser.id,
    created_by: appUser.id,
  });

  if (error) throw error;

  revalidateTaskPaths({ contact_id: input.contactId ?? null, deal_id: input.dealId ?? null });
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    dueAt?: string | null;
    priority?: TaskPriority;
    type?: TaskType;
    contactId?: string | null;
    dealId?: string | null;
    recurrenceInterval?: number | null;
    recurrenceUnit?: RecurrenceUnit | null;
  },
) {
  await requireAppUser();
  const supabase = await createClient();

  const payload: TaskUpdate = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.dueAt !== undefined) payload.due_at = patch.dueAt;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.type !== undefined) payload.type = patch.type;
  if (patch.contactId !== undefined) payload.contact_id = patch.contactId;
  if (patch.dealId !== undefined) payload.deal_id = patch.dealId;
  if (patch.recurrenceInterval !== undefined) payload.recurrence_interval = patch.recurrenceInterval;
  if (patch.recurrenceUnit !== undefined) payload.recurrence_unit = patch.recurrenceUnit;

  const { data, error } = await supabase.from("tasks").update(payload).eq("id", taskId).select("contact_id, deal_id").single();
  if (error) throw error;

  revalidateTaskPaths(data);
}

export async function snoozeTask(taskId: string, until: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("tasks").update({ snoozed_until: until }).eq("id", taskId).select("contact_id, deal_id").single();
  if (error) throw error;

  revalidateTaskPaths(data);
}

export async function unsnoozeTask(taskId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("tasks").update({ snoozed_until: null }).eq("id", taskId).select("contact_id, deal_id").single();
  if (error) throw error;

  revalidateTaskPaths(data);
}
