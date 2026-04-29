import { ParishCohortManager } from "@/components/parish-cohort-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function CohortsPage() {
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  return (
    <Card id="cohorts-section">
      <CardHeader>
        <CardTitle>Cohorts</CardTitle>
        <CardDescription>
          Organize enrolled learners into groups, assign facilitators, and set cadence.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <ParishCohortManager
          canManageAll={role === "parish_admin"}
          cohorts={data.cohorts}
          courses={data.visibleCourses}
          enrollments={data.enrollments}
          members={data.members}
        />
      </CardContent>
    </Card>
  );
}
