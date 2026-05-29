import { ParishEnrollmentManager } from "@/components/parish-enrollment-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function EnrollmentsPage() {
  const { parishId, role, clerkUserId } = await requireParishRole("parish_admin");

  if (role !== "parish_admin") {
    return null;
  }

  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  return (
    <Card id="enrollment-section">
      <CardHeader>
        <CardTitle>Enrollment Management</CardTitle>
        <CardDescription>
          Enroll parish members in visible courses and remove enrollments when needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <ParishEnrollmentManager courses={data.visibleCourses} enrollments={data.enrollments} members={data.members} />
      </CardContent>
    </Card>
  );
}
