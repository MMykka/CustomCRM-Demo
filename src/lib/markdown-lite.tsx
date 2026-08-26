import type { ReactNode } from "react";

// Hand-rolled "lite" markdown for notes: **bold**, *italic*, "- " bullet
// lines, and @[Name](userId) mention tokens (written by mention-textarea.tsx).
// No external markdown/rich-text library, per this project's explicit
// "lightweight notes editor" decision.
export function renderMarkdownLite(body: string): ReactNode {
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList(key: string) {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    listBuffer = [];
    blocks.push(
      <ul key={key} className="ml-4 list-disc">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  }

  lines.forEach((line, i) => {
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]!);
      return;
    }
    flushList(`list-${i}`);
    if (line.trim() === "") {
      blocks.push(<p key={`sp-${i}`} className="h-2" />);
    } else {
      blocks.push(<p key={`p-${i}`}>{renderInline(line)}</p>);
    }
  });
  flushList("list-end");

  return <>{blocks}</>;
}

function renderInline(text: string): ReactNode {
  const tokens: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|@\[[^\]]+\]\([0-9a-f-]{36}\))/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) tokens.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("**")) {
      tokens.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      tokens.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const mentionMatch = /^@\[([^\]]+)\]\([0-9a-f-]{36}\)$/.exec(token);
      tokens.push(
        <span key={key++} className="rounded bg-primary/10 px-1 font-medium text-primary">
          @{mentionMatch?.[1] ?? ""}
        </span>,
      );
    }

    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) tokens.push(text.slice(lastIndex));

  return tokens;
}
