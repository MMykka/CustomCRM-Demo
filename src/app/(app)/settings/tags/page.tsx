import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagManager } from "@/components/settings/tag-manager";
import { listTagsWithUsage } from "@/lib/actions/tags";

export default async function TagsPage() {
  const tags = await listTagsWithUsage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>Manage the tags available for contacts across the organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <TagManager tags={tags} />
      </CardContent>
    </Card>
  );
}
