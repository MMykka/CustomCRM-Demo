import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { contactDisplayName, initialsFor } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: company }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("*, owner:users(id, full_name, email)").eq("id", id).single(),
    supabase.from("contacts").select("*").eq("company_id", id).order("created_at", { ascending: false }),
  ]);

  if (!company) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {company.domain ? <span>{company.domain}</span> : null}
          {company.phone ? <span>{company.phone}</span> : null}
          {[company.city, company.state, company.country].filter(Boolean).length ? (
            <span>{[company.city, company.state, company.country].filter(Boolean).join(", ")}</span>
          ) : null}
          {company.owner ? <span>Owner: {company.owner.full_name ?? company.owner.email}</span> : null}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Contacts ({contacts?.length ?? 0})</h2>
        {contacts && contacts.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-md border">
            {contacts.map((contact) => {
              const name = contactDisplayName(contact);
              return (
                <li key={contact.id}>
                  <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs">{initialsFor(name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      {contact.email ? <p className="text-xs text-muted-foreground">{contact.email}</p> : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No contacts at this company yet.</p>
        )}
      </div>
    </div>
  );
}
