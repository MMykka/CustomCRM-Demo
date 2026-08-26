"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { contactDisplayName } from "@/lib/types";

export type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  matchReason: string;
  score: number;
};

export async function findDuplicateContacts(contactId: string): Promise<DuplicateCandidate[]> {
  await requireAppUser();
  const supabase = await createClient();

  const { data: matches, error } = await supabase.rpc("find_contact_duplicates", { p_contact_id: contactId });
  if (error) throw error;
  if (!matches || matches.length === 0) return [];

  const candidateIds = matches.map((m) => m.candidate_id);

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company:companies(name)")
    .in("id", candidateIds);

  if (contactsError) throw contactsError;

  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));

  return matches
    .map((m) => {
      const c = byId.get(m.candidate_id);
      if (!c) return null;
      const candidate: DuplicateCandidate = {
        id: c.id,
        name: contactDisplayName(c),
        email: c.email,
        phone: c.phone,
        companyName: c.company?.name ?? null,
        matchReason: m.match_reason,
        score: m.score,
      };
      return candidate;
    })
    .filter((c): c is DuplicateCandidate => c !== null);
}

export async function mergeContacts(winnerId: string, loserId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("merge_contacts", { winner_id: winnerId, loser_id: loserId });
  if (error) throw error;

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${winnerId}`);
  redirect(`/contacts/${winnerId}`);
}
