import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompanyHeader } from "@/components/companies/company-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import { UnifiedTimeline } from "@/components/contact/unified-timeline";
import { getCompanyTimeline } from "@/lib/company-timeline";
import { contactDisplayName, formatCurrency, initialsFor, LIFECYCLE_STAGE_LABELS, type LifecycleStage } from "@/lib/types";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: company }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("*, owner:users(id, full_name, email)").eq("id", id).single(),
    supabase.from("contacts").select("*").eq("company_id", id).order("created_at", { ascending: false }),
  ]);

  if (!company) notFound();

  const contactIds = (contacts ?? []).map((c) => c.id);
  const dealFilter = contactIds.length > 0 ? `company_id.eq.${id},contact_id.in.(${contactIds.join(",")})` : `company_id.eq.${id}`;

  const [{ data: deals }, timelineEvents] = await Promise.all([
    supabase
      .from("deals")
      .select("*, stage:stages(id, name), pipeline:pipelines(id, name), contact:contacts(id, first_name, last_name, email)")
      .or(dealFilter)
      .order("created_at", { ascending: false }),
    getCompanyTimeline(supabase, id, contactIds),
  ]);

  const openDeals = (deals ?? []).filter((d) => d.status === "open");
  const wonDeals = (deals ?? []).filter((d) => d.status === "won");
  const openDealValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const totalRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0);
  const currency = deals?.[0]?.currency ?? "USD";

  return (
    <div className="flex flex-col gap-6 p-6">
      <CompanyHeader company={company} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Contacts" value={String(contacts?.length ?? 0)} />
        <StatTile label="Open deals" value={String(openDeals.length)} hint={formatCurrency(openDealValue, currency)} accent="blue" />
        <StatTile label="Total revenue" value={formatCurrency(totalRevenue, currency)} hint={`${wonDeals.length} won`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
          <UnifiedTimeline events={timelineEvents} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border p-4">
            <h2 className="mb-3 text-sm font-semibold">Contacts ({contacts?.length ?? 0})</h2>
            {contacts && contacts.length > 0 ? (
              <ul className="flex flex-col divide-y">
                {contacts.map((contact) => {
                  const name = contactDisplayName(contact);
                  return (
                    <li key={contact.id}>
                      <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-accent">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">{initialsFor(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{name}</p>
                          {contact.email ? <p className="truncate text-xs text-muted-foreground">{contact.email}</p> : null}
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {LIFECYCLE_STAGE_LABELS[contact.lifecycle_stage as LifecycleStage]}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts at this company yet.</p>
            )}
          </div>

          <div className="rounded-xl border p-4">
            <h2 className="mb-3 text-sm font-semibold">Deals ({deals?.length ?? 0})</h2>
            {deals && deals.length > 0 ? (
              <ul className="flex flex-col divide-y">
                {deals.map((deal) => (
                  <li key={deal.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href="/pipeline" className="truncate text-sm font-medium hover:underline">
                        {deal.title}
                      </Link>
                      {deal.contact ? <p className="truncate text-xs text-muted-foreground">{contactDisplayName(deal.contact)}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={deal.status === "open" ? "outline" : deal.status === "won" ? "default" : "secondary"}>
                        {deal.status === "open" ? deal.stage?.name : deal.status}
                      </Badge>
                      <span className="text-sm font-medium">{formatCurrency(deal.value, deal.currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No deals yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
