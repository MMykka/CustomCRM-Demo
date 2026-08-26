"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, MessageSquare, Mail, CalendarPlus, ListPlus, Pencil } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TagEditor } from "@/components/contact/tag-editor";
import { LogActivityDialog } from "@/components/contact/log-activity-dialog";
import { LogMessageDialog } from "@/components/contact/log-message-dialog";
import { QuickTaskDialog } from "@/components/contact/quick-task-dialog";
import { EditContactDialog } from "@/components/contact/edit-contact-dialog";
import { contactDisplayName, initialsFor, LIFECYCLE_STAGE_LABELS, type Contact, type LifecycleStage, type Tag } from "@/lib/types";

type HeaderContact = Contact & {
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};

export function ContactHeader({ contact, allTags, activeTags }: { contact: HeaderContact; allTags: Tag[]; activeTags: Tag[] }) {
  const [callOpen, setCallOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const name = contactDisplayName(contact);

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-lg">{initialsFor(name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <Badge variant="outline">{LIFECYCLE_STAGE_LABELS[contact.lifecycle_stage as LifecycleStage]}</Badge>
            <Badge variant="secondary">Score {contact.lead_score}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {contact.email ? <span>{contact.email}</span> : null}
            {contact.phone ? <span>{contact.phone}</span> : null}
            {contact.job_title ? <span>{contact.job_title}</span> : null}
            {contact.company ? (
              <span>
                at{" "}
                <Link href={`/companies/${contact.company.id}`} className="hover:underline">
                  {contact.company.name}
                </Link>
              </span>
            ) : null}
            {contact.owner ? <span>Owner: {contact.owner.full_name ?? contact.owner.email}</span> : null}
            {contact.source ? <span>Source: {contact.source}</span> : null}
          </div>
          <TagEditor contactId={contact.id} allTags={allTags} activeTags={activeTags} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}>
          <Phone className="size-4" />
          Call
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSmsOpen(true)}>
          <MessageSquare className="size-4" />
          SMS
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
          <Mail className="size-4" />
          Email
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBookOpen(true)}>
          <CalendarPlus className="size-4" />
          Book
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}>
          <ListPlus className="size-4" />
          Add task
        </Button>
      </div>

      <LogActivityDialog kind="call" contactId={contact.id} open={callOpen} onOpenChange={setCallOpen} />
      <LogMessageDialog channel="sms" contactId={contact.id} toAddress={contact.phone} open={smsOpen} onOpenChange={setSmsOpen} />
      <LogMessageDialog channel="email" contactId={contact.id} toAddress={contact.email} open={emailOpen} onOpenChange={setEmailOpen} />
      <QuickTaskDialog
        contactId={contact.id}
        title="Schedule a meeting"
        defaultTitle={`Meeting with ${name}`}
        open={bookOpen}
        onOpenChange={setBookOpen}
      />
      <QuickTaskDialog contactId={contact.id} title="New task" defaultTitle="" open={taskOpen} onOpenChange={setTaskOpen} />
      <EditContactDialog contact={contact} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
