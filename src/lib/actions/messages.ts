"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function logOutboundMessage(
  contactId: string,
  input: { channel: "sms" | "email"; toAddress: string | null; subject?: string; body: string },
) {
  if (!input.body.trim()) return;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("messages").insert({
    organization_id: appUser.organization_id!,
    contact_id: contactId,
    user_id: appUser.id,
    channel: input.channel,
    direction: "outbound",
    from_address: appUser.email,
    to_address: input.toAddress,
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    status: "sent",
  });

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}
