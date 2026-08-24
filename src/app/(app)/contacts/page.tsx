import { createClient } from "@/lib/supabase/server";
import { ContactsTable, type ContactRow } from "@/components/contacts/contacts-table";

export default async function ContactsPage() {
  const supabase = await createClient();

  const [{ data: contacts, error }, { data: tags }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "*, company:companies(id, name), owner:users(id, full_name, email), contact_tags(tags(*))",
      )
      .order("created_at", { ascending: false }),
    supabase.from("tags").select("*").order("name"),
  ]);

  if (error) {
    throw error;
  }

  const rows: ContactRow[] = (contacts ?? []).map((contact) => ({
    ...contact,
    tags: contact.contact_tags.map((ct) => ct.tags).filter((tag) => tag !== null),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">{rows.length} contacts</p>
      </div>
      <ContactsTable data={rows} allTags={tags ?? []} />
    </div>
  );
}
