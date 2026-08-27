import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ContactHeader } from "@/components/contact/contact-header";
import { DuplicateBanner } from "@/components/contact/duplicate-banner";
import { findDuplicateContacts } from "@/lib/actions/duplicates";
import { ContactDetailLayout, RailSection } from "@/components/contact/contact-detail-layout";
import { UnifiedTimeline } from "@/components/contact/unified-timeline";
import { getContactTimeline } from "@/lib/timeline";
import { NotesPanel, type NoteWithAuthor } from "@/components/contact/notes-panel";
import { FilesPanel, type FileWithUploader } from "@/components/contact/files-panel";
import { SequenceEnrollmentsPanel, type EnrollmentWithSequence } from "@/components/contact/sequence-enrollments-panel";
import { ConsentPanel } from "@/components/contact/consent-panel";
import { AiAssistantPanel } from "@/components/contact/ai-assistant-panel";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";
import { contactDisplayName, formatCurrency, type ConsentStatus } from "@/lib/types";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: contact },
    { data: allTags },
    { data: deals },
    { data: tasks },
    timelineEvents,
    { data: notes },
    { data: members },
    { data: files },
    { data: enrollments },
    { data: availableSequences },
    { data: customFields },
    { data: customValues },
    duplicateCandidates,
  ] = await Promise.all([
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
    getContactTimeline(supabase, id),
    supabase
      .from("notes")
      .select("*, author:users!notes_author_id_fkey(full_name, email)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id, full_name, email"),
    supabase.from("files").select("*, uploader:users(full_name, email)").eq("contact_id", id).order("created_at", { ascending: false }),
    supabase
      .from("sequence_enrollments")
      .select("*, sequence:sequences(id, name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("sequences").select("id, name").eq("is_active", true).order("name"),
    supabase.from("custom_fields").select("*").eq("entity_type", "contact").order("position"),
    supabase.from("custom_field_values").select("*").eq("entity_type", "contact").eq("entity_id", id),
    findDuplicateContacts(id),
  ]);

  if (!contact) notFound();

  const activeTags = contact.contact_tags.map((ct) => ct.tags).filter((tag) => tag !== null);
  const valuesByField = new Map((customValues ?? []).map((v) => [v.custom_field_id, v.value]));

  return (
    <div className="flex flex-col gap-6 p-6">
      <DuplicateBanner
        currentContact={{ id: contact.id, name: contactDisplayName(contact), email: contact.email, phone: contact.phone }}
        candidates={duplicateCandidates}
      />
      <ContactHeader contact={contact} allTags={allTags ?? []} activeTags={activeTags} />

      <ContactDetailLayout
        main={
          <>
            <RailSection title="Timeline">
              <UnifiedTimeline events={timelineEvents} />
            </RailSection>
            <RailSection title="Notes">
              <NotesPanel entity={{ contactId: contact.id }} notes={(notes ?? []) as NoteWithAuthor[]} members={members ?? []} />
            </RailSection>
          </>
        }
        rail={
          <>
            <RailSection title="AI Assistant">
              <AiAssistantPanel contactId={contact.id} />
            </RailSection>

            <RailSection title={`Deals (${deals?.length ?? 0})`}>
              {deals && deals.length > 0 ? (
                <ul className="flex flex-col divide-y">
                  {deals.map((deal) => (
                    <li key={deal.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <Link href="/pipeline" className="truncate text-sm font-medium hover:underline">
                          {deal.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{deal.pipeline?.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">{deal.stage?.name}</Badge>
                        <span className="text-sm font-medium">{formatCurrency(deal.value, deal.currency)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No deals yet.</p>
              )}
            </RailSection>

            <RailSection title={`Tasks (${tasks?.length ?? 0})`}>
              <TaskChecklist tasks={(tasks ?? []) as TaskRow[]} contactId={contact.id} />
            </RailSection>

            <RailSection title={`Files (${files?.length ?? 0})`}>
              <FilesPanel
                entity={{ contactId: contact.id }}
                organizationId={contact.organization_id}
                files={(files ?? []) as FileWithUploader[]}
              />
            </RailSection>

            <RailSection title={`Sequences (${enrollments?.length ?? 0})`}>
              <SequenceEnrollmentsPanel
                contactId={contact.id}
                enrollments={(enrollments ?? []) as EnrollmentWithSequence[]}
                availableSequences={availableSequences ?? []}
              />
            </RailSection>

            <RailSection title="Consent">
              <ConsentPanel
                contactId={contact.id}
                consentStatus={contact.consent_status as ConsentStatus}
                emailOptOut={contact.email_opt_out}
                smsOptOut={contact.sms_opt_out}
                consentUpdatedAt={contact.consent_updated_at}
              />
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
                <p className="text-sm text-muted-foreground">No custom fields defined for contacts yet.</p>
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
