import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldsEditor } from "@/components/settings/custom-fields-editor";
import { listCustomFields } from "@/lib/actions/custom-fields";

export default async function CustomFieldsPage() {
  const fields = await listCustomFields();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom fields</CardTitle>
        <CardDescription>Add fields to contacts, companies, and deals beyond the built-in ones.</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomFieldsEditor fields={fields} />
      </CardContent>
    </Card>
  );
}
