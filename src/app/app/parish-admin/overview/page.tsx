import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";
import Link from "next/link";

export default async function OverviewPage() {
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  const roleLabel = role === "parish_admin" ? "Parish Admin" : "Facilitator";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant="role">{roleLabel}</Badge>
      </div>
      <p className="text-[13.5px] text-muted-foreground">
        {role === "parish_admin"
          ? "Adopt parish-scoped courses, manage learner enrollments, and monitor current participation."
          : "Manage assigned cohorts and monitor participation for your learners."}
      </p>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Parish members</CardDescription>
            <CardTitle className="text-2xl">{data.overview.memberCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total enrollments</CardDescription>
            <CardTitle className="text-2xl">{data.overview.enrollmentCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active learners</CardDescription>
            <CardTitle className="text-2xl">{data.overview.activeLearnerCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stalled learners (31+ days)</CardDescription>
            <CardTitle className="text-2xl">{data.overview.stalledLearnerCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion rate</CardDescription>
            <CardTitle className="text-2xl">{data.overview.completionRate}%</CardTitle>
          </CardHeader>
        </Card>
      </section>

      {role === "parish_admin" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending join requests</CardDescription>
            <CardTitle className="text-2xl">{data.overview.pendingJoinRequestCount.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/parish-admin/join-requests">Review requests</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {role === "parish_admin" && data.dioceseCourses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Diocese-wide Courses</CardTitle>
            <CardDescription>These courses are already visible to your parish by diocesan policy.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.dioceseCourses.map((course) => (
                <li key={course.id}>
                  <span className="font-medium">{course.title}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}