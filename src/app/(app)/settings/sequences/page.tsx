import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SequencesList } from "@/components/settings/sequences-list";
import { listSequencesForSettings } from "@/lib/actions/sequences";

export default async function SequencesPage() {
  const sequences = await listSequencesForSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sequences</CardTitle>
        <CardDescription>Automated follow-up sequences contacts can be enrolled in.</CardDescription>
      </CardHeader>
      <CardContent>
        <SequencesList sequences={sequences} />
      </CardContent>
    </Card>
  );
}
