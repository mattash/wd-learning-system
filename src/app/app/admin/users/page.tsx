import { AdminUserDirectoryManager } from "@/components/admin-user-directory-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDioceseUserDirectory } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminUsersPage() {
  const directoryData = await listDioceseUserDirectory(200);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Search, filter, and edit user profiles, diocesan access, and parish memberships across the diocese.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <AdminUserDirectoryManager initialParishes={directoryData.parishes} initialUsers={directoryData.users} />
        </CardContent>
      </Card>
    </div>
  );
}
