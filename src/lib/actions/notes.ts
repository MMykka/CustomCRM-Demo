"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export type NoteEntity = { contactId?: string; dealId?: string };

// Extracts @[Full Name](userId) mention tokens written by mention-textarea.tsx.
function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(/@\[[^\]]+\]\(([0-9a-f-]{36})\)/gi)) {
    ids.add(match[1]!);
  }
  return [...ids];
}

function pathForEntity(entity: NoteEntity) {
  if (entity.dealId) return `/pipeline/${entity.dealId}`;
  if (entity.contactId) return `/contacts/${entity.contactId}`;
  return null;
}

export async function addNote(entity: NoteEntity, body: string) {
  if (!body.trim()) return;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("notes").insert({
    organization_id: appUser.organization_id!,
    contact_id: entity.contactId ?? null,
    deal_id: entity.dealId ?? null,
    author_id: appUser.id,
    body: body.trim(),
    mentioned_user_ids: extractMentionedUserIds(body),
  });

  if (error) throw error;

  const path = pathForEntity(entity);
  if (path) revalidatePath(path);
}

export async function updateNote(noteId: string, entity: NoteEntity, body: string) {
  if (!body.trim()) return;

  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notes")
    .update({ body: body.trim(), mentioned_user_ids: extractMentionedUserIds(body) })
    .eq("id", noteId);

  if (error) throw error;

  const path = pathForEntity(entity);
  if (path) revalidatePath(path);
}

export async function togglePinNote(noteId: string, entity: NoteEntity, pinned: boolean) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notes")
    .update({
      is_pinned: pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
      pinned_by: pinned ? appUser.id : null,
    })
    .eq("id", noteId);

  if (error) throw error;

  const path = pathForEntity(entity);
  if (path) revalidatePath(path);
}

export async function deleteNote(noteId: string, entity: NoteEntity) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;

  const path = pathForEntity(entity);
  if (path) revalidatePath(path);
}
