import { AdminMembershipForm } from "@/components/admin-membership-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDioceseAdmin } from "@/lib/authz";

export default async function MembershipToolsPage() {
  await requireDioceseAdmin();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Membership Admin Tool</CardTitle>
          <CardDescription>
            Assign parish memberships and/or promote a user to diocese admin.
          </CardDescription>
        </CardHeader>
      </Card>
      <AdminMembershipForm />
    </div>
  );
}
