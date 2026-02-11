import { AdminEngagementReport } from "@/components/admin-engagement-report";
import { AdminEnrollmentManager } from "@/components/admin-enrollment-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCourses, listEngagement, listEnrollments, listParishes } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminEngagementPage() {
  const [engagementRows, enrollments, parishes, courses] = await Promise.all([
    listEngagement(200),
    listEnrollments(200),
    listParishes(200),
    listCourses(200),
  ]);

  const startedTotal = engagementRows.reduce((sum, row) => sum + row.learners_started, 0);
  const completedTotal = engagementRows.reduce((sum, row) => sum + row.learners_completed, 0);
  const completionRate = startedTotal ? Math.round((completedTotal / startedTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total started learners</CardDescription>
            <CardTitle className="text-2xl">{startedTotal.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total completed learners</CardDescription>
            <CardTitle className="text-2xl">{completedTotal.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion rate</CardDescription>
            <CardTitle className="text-2xl">{completionRate}%</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment management</CardTitle>
          <CardDescription>Manually add or remove parish enrollments for specific courses.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <AdminEnrollmentManager courses={courses} enrollments={enrollments} parishes={parishes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement report</CardTitle>
          <CardDescription>
            Filter by parish/course, export CSV, and drill into learner-level progress.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <AdminEngagementReport courses={courses} parishes={parishes} />
        </CardContent>
      </Card>
    </div>
  );
}
