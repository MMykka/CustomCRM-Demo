import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealHeader } from "@/components/pipeline/deal-header";
import { ContactDetailLayout, RailSection } from "@/components/contact/contact-detail-layout";
import { UnifiedTimeline } from "@/components/contact/unified-timeline";
import { getDealTimeline } from "@/lib/deal-timeline";
import { NotesPanel, type NoteWithAuthor } from "@/components/contact/notes-panel";
import { FilesPanel, type FileWithUploader } from "@/components/contact/files-panel";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: deal },
    { data: tasks },
    timelineEvents,
    { data: notes },
    { data: members },
    { data: files },
    { data: customFields },
    { data: customValues },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("*, contact:contacts(id, first_name, last_name, email), company:companies(id, name), owner:users(id, full_name, email), stage:stages(*)")
      .eq("id", id)
      .single(),
    supabase.from("tasks").select("*, contact:contacts(id, first_name, last_name, email)").eq("deal_id", id).order("due_at", { ascending: true }),
    getDealTimeline(supabase, id),
    supabase
      .from("notes")
      .select("*, author:users!notes_author_id_fkey(full_name, email)")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, full_name, email"),
    supabase.from("files").select("*, uploader:users(full_name, email)").eq("deal_id", id).order("created_at", { ascending: false }),
    supabase.from("custom_fields").select("*").eq("entity_type", "deal").order("position"),
    supabase.from("custom_field_values").select("*").eq("entity_type", "deal").eq("entity_id", id),
  ]);

  if (!deal) notFound();

  const valuesByField = new Map((customValues ?? []).map((v) => [v.custom_field_id, v.value]));

  return (
    <div className="flex flex-col gap-6 p-6">
      <DealHeader deal={deal} stage={deal.stage!} />

      <ContactDetailLayout
        main={
          <>
            <RailSection title="Timeline">
              <UnifiedTimeline events={timelineEvents} />
            </RailSection>
            <RailSection title="Notes">
              <NotesPanel entity={{ dealId: deal.id }} notes={(notes ?? []) as NoteWithAuthor[]} members={members ?? []} />
            </RailSection>
          </>
        }
        rail={
          <>
            <RailSection title={`Tasks (${tasks?.length ?? 0})`}>
              <TaskChecklist tasks={(tasks ?? []) as TaskRow[]} dealId={deal.id} />
            </RailSection>

            <RailSection title={`Files (${files?.length ?? 0})`}>
              <FilesPanel entity={{ dealId: deal.id }} organizationId={deal.organization_id} files={(files ?? []) as FileWithUploader[]} />
            </RailSection>

            <RailSection title="Custom fields">
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
                <p className="text-sm text-muted-foreground">No custom fields defined for deals yet.</p>
              )}
            </RailSection>
          </>
        }
      />
    </div>
  );
}

function formatCustomValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
