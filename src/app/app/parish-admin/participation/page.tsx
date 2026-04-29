import { ParishParticipationManager } from "@/components/parish-participation-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function ParticipationPage() {
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  return (
    <Card id="participation-section">
      <CardHeader>
        <CardTitle>Participation Watchlist</CardTitle>
        <CardDescription>
          Track learner progress by status and identify who needs intervention.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <ParishParticipationManager
          canLogCommunications={role === "parish_admin"}
          cohorts={data.cohorts}
          courses={data.visibleCourses}
          members={data.members}
          participationRows={data.participationRows}
        />
      </CardContent>
    </Card>
  );
}
