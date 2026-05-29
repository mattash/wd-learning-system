import { ParishPeopleManager } from "@/components/parish-people-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function PeoplePage() {
  const { parishId, role, clerkUserId } = await requireParishRole("parish_admin");

  if (role !== "parish_admin") {
    return null;
  }

  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  return (
    <Card id="people-section">
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Add existing platform users to this parish, update roles, and import memberships in bulk via CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <ParishPeopleManager members={data.members} />
      </CardContent>
    </Card>
  );
}
