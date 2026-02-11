import { AdminUserAccessManager } from "@/components/admin-user-access-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDioceseUsers } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminUsersPage() {
  const users = await listDioceseUsers(100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>User access management</CardTitle>
          <CardDescription>
            Promote or revoke diocesan admins and add/remove parish memberships via diocesan API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUserAccessManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Recent user profiles across every parish in the diocese.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Clerk user ID</th>
                <th className="py-2 pr-4 font-medium">Onboarded</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t" key={user.clerk_user_id}>
                  <td className="py-2 pr-4">{user.display_name ?? "—"}</td>
                  <td className="py-2 pr-4">{user.email ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{user.clerk_user_id}</td>
                  <td className="py-2 pr-4">{user.onboarding_completed_at ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
