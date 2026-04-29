import { AdminEngagementReport } from "@/components/admin-engagement-report";
import { AdminEnrollmentManager } from "@/components/admin-enrollment-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
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
  const enrolledTotal = enrollments.length;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Avg. Completion Rate
          </div>
          <div className="font-display text-[30px] font-bold tracking-tight leading-none text-success">
            {completionRate}%
          </div>
          <ProgressBar value={completionRate} variant="success" className="mt-2.5" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Active This Month
          </div>
          <div className="font-display text-[30px] font-bold tracking-tight leading-none">
            {startedTotal}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">of {enrolledTotal} enrolled learners</div>
        </div>
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
          <CardTitle>Per-Course Engagement</CardTitle>
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
