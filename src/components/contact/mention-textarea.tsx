"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { initialsFor } from "@/lib/types";

export type MentionCandidate = { id: string; full_name: string | null; email: string };

// Lightweight @mention autocomplete: no popover-anchoring/portal library,
// just a plain dropdown under the textarea filtered by the word after the
// last "@". Selecting a match inserts an @[Full Name](userId) token that
// notes.ts parses back out server-side and markdown-lite.tsx renders as a
// mention chip.
export function MentionTextarea({
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  members: MentionCandidate[];
  placeholder?: string;
  rows?: number;
}) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const matches =
    mentionQuery === null
      ? []
      : members.filter((m) => (m.full_name ?? m.email).toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = e.target.value;
    onChange(nextValue);

    const cursor = e.target.selectionStart ?? nextValue.length;
    const uptoCursor = nextValue.slice(0, cursor);
    const match = /@([a-zA-Z0-9._-]*)$/.exec(uptoCursor);
    if (match) {
      setMentionQuery(match[1]!);
      setMentionStart(cursor - match[1]!.length - 1);
    } else {
      setMentionQuery(null);
      setMentionStart(null);
    }
  }

  function selectMention(member: MentionCandidate) {
    if (mentionStart === null) return;
    const displayName = member.full_name ?? member.email;
    const token = `@[${displayName}](${member.id})`;
    const cursor = mentionStart + 1 + (mentionQuery?.length ?? 0);
    onChange(value.slice(0, mentionStart) + token + " " + value.slice(cursor));
    setMentionQuery(null);
    setMentionStart(null);
  }

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setMentionQuery(null);
            setMentionStart(null);
          }
        }}
        placeholder={placeholder}
        rows={rows}
      />
      {mentionQuery !== null && matches.length > 0 ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {matches.map((member) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectMention(member);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px]">
                {initialsFor(member.full_name ?? member.email)}
              </span>
              {member.full_name ?? member.email}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
