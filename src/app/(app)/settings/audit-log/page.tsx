import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditLogTable } from "@/components/settings/audit-log-table";
import { listAuditLog, listAuditLogTables } from "@/lib/actions/audit-log";

export default async function AuditLogPage() {
  const [rows, tableNames] = await Promise.all([listAuditLog(), listAuditLogTables()]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Every change made to records in this organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuditLogTable initialRows={rows} tableNames={tableNames} />
      </CardContent>
    </Card>
  );
}
