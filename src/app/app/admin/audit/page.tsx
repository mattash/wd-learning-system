import { AdminAuditLogViewer } from "@/components/admin-audit-log-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminAuditLogs } from "@/lib/audit-log";

export default async function DioceseAdminAuditPage() {
  const logs = await listAdminAuditLogs({ limit: 100 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit logs</CardTitle>
        <CardDescription>Review admin actions for governance and traceability.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <AdminAuditLogViewer initialLogs={logs} />
      </CardContent>
    </Card>
  );
}
