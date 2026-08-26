import { createClient } from "@/lib/supabase/server";
import { ContactsList } from "@/components/contacts/contacts-list";
import { parseContactsFilters, queryContacts, CONTACTS_PAGE_SIZE } from "@/lib/contacts-query";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import { listSavedViews } from "@/lib/actions/saved-views";
import type { ContactRow } from "@/components/contacts/contacts-table";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const filters = parseContactsFilters(resolvedSearchParams);
  const supabase = await createClient();

  const [
    { rows, totalCount },
    { data: allTags },
    owners,
    savedViews,
    { data: sourceRows },
    {
      data: { user },
    },
  ] = await Promise.all([
    queryContacts(supabase, filters),
    supabase.from("tags").select("*").order("name"),
    listOrgMembersForPicker(),
    listSavedViews(),
    supabase.from("contacts").select("source").not("source", "is", null),
    supabase.auth.getUser(),
  ]);

  const availableSources = [...new Set((sourceRows ?? []).map((r) => r.source).filter((s): s is string => Boolean(s)))].sort();

  const contactRows: ContactRow[] = rows.map((contact) => ({
    ...contact,
    tags: contact.contact_tags.map((ct) => ct.tags).filter((tag) => tag !== null),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground">{totalCount} contacts</p>
      </div>
      <ContactsList
        rows={contactRows}
        totalCount={totalCount}
        page={filters.page}
        pageSize={CONTACTS_PAGE_SIZE}
        allTags={allTags ?? []}
        owners={owners}
        availableSources={availableSources}
        savedViews={savedViews}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}
