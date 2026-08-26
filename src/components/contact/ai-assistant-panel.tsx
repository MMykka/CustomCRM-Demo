"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeContact, suggestNextAction } from "@/lib/actions/ai";

export function AiAssistantPanel({ contactId }: { contactId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ text: string } | { error: string }>) {
    setError(null);
    startTransition(async () => {
      const response = await action(contactId);
      if ("error" in response) {
        setError(response.error);
        setResult(null);
      } else {
        setResult(response.text);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(summarizeContact)}>
          <Sparkles className="size-3.5" />
          Summarize
        </Button>
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(suggestNextAction)}>
          <Sparkles className="size-3.5" />
          Suggest next action
        </Button>
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Thinking...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <p className="whitespace-pre-line text-sm">{result}</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">AI-generated — verify before acting on it.</p>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                navigator.clipboard.writeText(result);
                toast.success("Copied");
              }}
              title="Copy"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
