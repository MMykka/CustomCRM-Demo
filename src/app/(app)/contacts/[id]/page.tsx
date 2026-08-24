import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TagEditor } from "@/components/contact/tag-editor";
import { ActivityTimeline, type ActivityWithUser } from "@/components/contact/activity-timeline";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";
import { contactDisplayName, formatCurrency, initialsFor } from "@/lib/types";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: contact }, { data: allTags }, { data: deals }, { data: tasks }, { data: activities }, { data: customFields }, { data: customValues }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*, company:companies(id, name), owner:users(id, full_name, email), contact_tags(tags(*))")
        .eq("id", id)
        .single(),
      supabase.from("tags").select("*").order("name"),
      supabase
        .from("deals")
        .select("*, stage:stages(id, name), pipeline:pipelines(id, name)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("tasks").select("*, contact:contacts(id, first_name, last_name, email)").eq("contact_id", id).order("due_at", { ascending: true }),
      supabase
        .from("activities")
        .select("*, user:users(full_name, email)")
        .eq("contact_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("custom_fields").select("*").eq("entity_type", "contact").order("position"),
      supabase.from("custom_field_values").select("*").eq("entity_type", "contact").eq("entity_id", id),
    ]);

  if (!contact) notFound();

  const name = contactDisplayName(contact);
  const activeTags = contact.contact_tags.map((ct) => ct.tags).filter((tag) => tag !== null);
  const valuesByField = new Map((customValues ?? []).map((v) => [v.custom_field_id, v.value]));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-lg">{initialsFor(name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {contact.email ? <span>{contact.email}</span> : null}
            {contact.phone ? <span>{contact.phone}</span> : null}
            {contact.job_title ? <span>{contact.job_title}</span> : null}
            {contact.company ? <span>at {contact.company.name}</span> : null}
            {contact.owner ? <span>Owner: {contact.owner.full_name ?? contact.owner.email}</span> : null}
          </div>
          <TagEditor contactId={contact.id} allTags={allTags ?? []} activeTags={activeTags} />
        </div>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="max-w-2xl">
          <ActivityTimeline contactId={contact.id} activities={(activities ?? []) as ActivityWithUser[]} />
        </TabsContent>

        <TabsContent value="deals">
          {deals && deals.length > 0 ? (
            <ul className="flex flex-col divide-y">
              {deals.map((deal) => (
                <li key={deal.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link href="/pipeline" className="text-sm font-medium hover:underline">
                      {deal.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{deal.pipeline?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{deal.stage?.name}</Badge>
                    <span className="text-sm font-medium">{formatCurrency(deal.value, deal.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No deals yet.</p>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="max-w-2xl">
          <TaskChecklist tasks={(tasks ?? []) as TaskRow[]} contactId={contact.id} />
        </TabsContent>

        <TabsContent value="details" className="max-w-md">
          {customFields && customFields.length > 0 ? (
            <dl className="flex flex-col gap-3">
              {customFields.map((field) => (
                <div key={field.id}>
                  <dt className="text-xs font-medium uppercase text-muted-foreground">{field.name}</dt>
                  <dd className="text-sm">{formatCustomValue(valuesByField.get(field.id))}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No custom fields defined for contacts yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatCustomValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
