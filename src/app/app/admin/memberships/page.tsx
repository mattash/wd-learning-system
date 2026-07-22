import { AdminMembershipForm } from "@/components/admin-membership-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDioceseAdmin } from "@/lib/authz";

export default async function MembershipToolsPage() {
  await requireDioceseAdmin();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Parish Memberships</CardTitle>
          <CardDescription>
            Assign users to parishes. Users can belong to one or more parishes.
          </CardDescription>
        </CardHeader>
        <AdminMembershipForm />
      </Card>

      <div>
        <Alert variant="warning" className="border-warning">
          <AlertDescription>
            <span className="text-xs font-bold text-warning">Admin note</span>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              System administrators can read and modify all content across all parishes. Only grant this role to
              trusted staff.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
