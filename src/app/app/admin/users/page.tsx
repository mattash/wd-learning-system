import { AdminUserDirectoryManager } from "@/components/admin-user-directory-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDioceseUserDirectory } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminUsersPage() {
  const directoryData = await listDioceseUserDirectory(200);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          All registered users across the diocese. Manage roles and parish assignments.
        </CardDescription>
      </CardHeader>
      <div className="overflow-auto">
        <AdminUserDirectoryManager initialParishes={directoryData.parishes} initialUsers={directoryData.users} />
      </div>
    </Card>
  );
}
