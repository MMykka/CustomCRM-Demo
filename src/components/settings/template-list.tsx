"use client";

import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteMessageTemplate } from "@/lib/actions/message-templates";
import { TemplateFormDialog } from "@/components/settings/template-form";
import type { Tables } from "@/lib/supabase/database.types";

type Template = Tables<"message_templates">;

export function TemplateList({ templates }: { templates: Template[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <TemplateFormDialog trigger={<Button size="sm">New template</Button>} />
      </div>
      {templates.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No templates yet.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{template.name}</p>
                  <Badge variant="outline" className="uppercase">
                    {template.channel}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{template.subject || template.body}</p>
              </div>
              <TemplateFormDialog
                template={template}
                trigger={
                  <Button variant="ghost" size="icon-sm">
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => startTransition(() => deleteMessageTemplate(template.id))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
