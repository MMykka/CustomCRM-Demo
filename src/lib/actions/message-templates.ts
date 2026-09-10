"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function listMessageTemplates() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createMessageTemplate(input: { name: string; channel: "sms" | "email"; subject: string | null; body: string }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("message_templates").insert({
    organization_id: appUser.organization_id!,
    name: input.name,
    channel: input.channel,
    subject: input.channel === "email" ? input.subject : null,
    body: input.body,
    created_by: appUser.id,
  });

  if (error) throw error;
  revalidatePath("/settings/templates");
}

export async function updateMessageTemplate(
  templateId: string,
  input: { name: string; subject: string | null; body: string },
) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("message_templates")
    .update({ name: input.name, subject: input.subject, body: input.body })
    .eq("id", templateId);

  if (error) throw error;
  revalidatePath("/settings/templates");
}

export async function deleteMessageTemplate(templateId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("message_templates").delete().eq("id", templateId);
  if (error) throw error;

  revalidatePath("/settings/templates");
}
