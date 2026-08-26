"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { contactDisplayName } from "@/lib/types";

export type SearchResults = {
  contacts: { id: string; label: string; sublabel: string | null }[];
  companies: { id: string; label: string; sublabel: string | null }[];
  deals: { id: string; label: string; sublabel: string | null }[];
  messages: { id: string; label: string; sublabel: string | null; contactId: string | null }[];
  notes: { id: string; label: string; sublabel: string | null; contactId: string | null }[];
  files: { id: string; label: string; sublabel: string | null; contactId: string | null }[];
};

const EMPTY_RESULTS: SearchResults = { contacts: [], companies: [], deals: [], messages: [], notes: [], files: [] };

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return EMPTY_RESULTS;

  await requireAppUser();
  const supabase = await createClient();
  const like = `%${q}%`;

  const [{ data: contacts }, { data: companies }, { data: deals }, { data: messages }, { data: notes }, { data: files }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .limit(5),
    supabase.from("companies").select("id, name, domain").ilike("name", like).limit(5),
    supabase.from("deals").select("id, title, value, currency").ilike("title", like).limit(5),
    supabase.from("messages").select("id, subject, body, contact_id").or(`subject.ilike.${like},body.ilike.${like}`).limit(5),
    supabase.from("notes").select("id, body, contact_id").ilike("body", like).limit(5),
    supabase.from("files").select("id, file_name, contact_id").ilike("file_name", like).limit(5),
  ]);

  return {
    contacts: (contacts ?? []).map((c) => ({ id: c.id, label: contactDisplayName(c), sublabel: c.email })),
    companies: (companies ?? []).map((c) => ({ id: c.id, label: c.name, sublabel: c.domain })),
    deals: (deals ?? []).map((d) => ({ id: d.id, label: d.title, sublabel: `${d.currency} ${d.value}` })),
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      label: m.subject || (m.body ? m.body.slice(0, 60) : "Message"),
      sublabel: null,
      contactId: m.contact_id,
    })),
    notes: (notes ?? []).map((n) => ({ id: n.id, label: n.body.slice(0, 60), sublabel: null, contactId: n.contact_id })),
    files: (files ?? []).map((f) => ({ id: f.id, label: f.file_name, sublabel: null, contactId: f.contact_id })),
  };
}
