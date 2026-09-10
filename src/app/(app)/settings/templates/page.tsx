import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateList } from "@/components/settings/template-list";
import { listMessageTemplates } from "@/lib/actions/message-templates";

export default async function TemplatesPage() {
  const templates = await listMessageTemplates();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message templates</CardTitle>
        <CardDescription>Reusable SMS and email templates with merge fields.</CardDescription>
      </CardHeader>
      <CardContent>
        <TemplateList templates={templates} />
      </CardContent>
    </Card>
  );
}
