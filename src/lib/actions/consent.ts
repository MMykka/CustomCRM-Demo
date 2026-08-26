"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { ConsentStatus } from "@/lib/types";

export async function updateConsent(contactId: string, input: { consentStatus: ConsentStatus; emailOptOut: boolean; smsOptOut: boolean }) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      consent_status: input.consentStatus,
      email_opt_out: input.emailOptOut,
      sms_opt_out: input.smsOptOut,
      consent_updated_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}
