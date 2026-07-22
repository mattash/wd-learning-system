import { AdminUserDirectoryManager } from "@/components/admin-user-directory-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDioceseAdmin } from "@/lib/authz";
import { listDioceseUserDirectory } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminUsersPage() {
  await requireDioceseAdmin();

  const directoryData = await listDioceseUserDirectory(200);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          All registered users in the learning system. Manage roles and parish assignments.
        </CardDescription>
      </CardHeader>
      <div className="overflow-auto">
        <AdminUserDirectoryManager initialParishes={directoryData.parishes} initialUsers={directoryData.users} />
      </div>
    </Card>
  );
}
