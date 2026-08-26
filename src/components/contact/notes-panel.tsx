"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionTextarea, type MentionCandidate } from "@/components/contact/mention-textarea";
import { renderMarkdownLite } from "@/lib/markdown-lite";
import { addNote, deleteNote, togglePinNote } from "@/lib/actions/notes";
import type { Note } from "@/lib/types";

export type NoteWithAuthor = Note & { author: { full_name: string | null; email: string } | null };

export function NotesPanel({ contactId, notes, members }: { contactId: string; notes: NoteWithAuthor[]; members: MentionCandidate[] }) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const pinned = notes.filter((n) => n.is_pinned);
  const rest = notes.filter((n) => !n.is_pinned);

  function submit() {
    if (!draft.trim()) return;
    startTransition(async () => {
      await addNote(contactId, draft);
      setDraft("");
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <MentionTextarea value={draft} onChange={setDraft} members={members} placeholder="Add a note... type @ to mention someone" rows={3} />
        <div>
          <Button size="sm" onClick={submit} disabled={isPending || !draft.trim()}>
            {isPending ? "Adding..." : "Add note"}
          </Button>
        </div>
      </div>

      {pinned.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Pinned</p>
          {pinned.map((note) => (
            <NoteItem key={note.id} note={note} contactId={contactId} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {rest.length === 0 && pinned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          rest.map((note) => <NoteItem key={note.id} note={note} contactId={contactId} />)
        )}
      </div>
    </div>
  );
}

function NoteItem({ note, contactId }: { note: NoteWithAuthor; contactId: string }) {
  const [isPending, startTransition] = useTransition();
  const author = note.author?.full_name ?? note.author?.email ?? "Someone";

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{author}</span> · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            onClick={() => startTransition(() => togglePinNote(note.id, contactId, !note.is_pinned))}
            title={note.is_pinned ? "Unpin" : "Pin"}
          >
            {note.is_pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            onClick={() => startTransition(() => deleteNote(note.id, contactId))}
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="text-sm">{renderMarkdownLite(note.body)}</div>
    </div>
  );
}
