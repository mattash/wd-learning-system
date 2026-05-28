import { AdminAuditLogViewer } from "@/components/admin-audit-log-viewer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminAuditLogs } from "@/lib/audit-log";
import { requireDioceseAdmin } from "@/lib/authz";

export default async function DioceseAdminAuditPage() {
  await requireDioceseAdmin();

  const logs = await listAdminAuditLogs({ limit: 100 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>System-level record of administrative actions across the diocese.</CardDescription>
      </CardHeader>
      <div className="overflow-auto">
        <AdminAuditLogViewer initialLogs={logs} />
      </div>
    </Card>
  );
}
