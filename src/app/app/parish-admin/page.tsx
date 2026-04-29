import { ParishCourseAdoptionManager } from "@/components/parish-course-adoption-manager";
import { ParishCohortManager } from "@/components/parish-cohort-manager";
import { ParishCommunicationsManager } from "@/components/parish-communications-manager";
import { ParishEnrollmentManager } from "@/components/parish-enrollment-manager";
import { ParishAdminNav } from "@/components/parish-admin-nav";
import { ParishPeopleManager } from "@/components/parish-people-manager";
import { ParishParticipationManager } from "@/components/parish-participation-manager";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ParishAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const communicationPrefill = {
    audienceType: firstValue(params.audienceType) ?? null,
    audienceValue: firstValue(params.audienceValue) ?? null,
    subject: firstValue(params.subject) ?? null,
    body: firstValue(params.body) ?? null,
  };
  const { parishId, role, clerkUserId } = await requireParishRole("instructor");
  const {
    visibleCourses,
    dioceseCourses,
    adoptedParishCourses,
    availableParishCourses,
    enrollments,
    members,
    cohorts,
    overview,
    communicationSends,
    participationRows,
  } = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });
  const roleLabel = role === "parish_admin" ? "Parish Admin" : "Facilitator";

  return (
    <div className="space-y-6" id="top">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[22px] font-bold tracking-tight">Parish Admin Dashboard</h1>
          <Badge variant="role">{roleLabel}</Badge>
        </div>
        <p className="text-[13.5px] text-muted-foreground">
          {role === "parish_admin"
            ? "Adopt parish-scoped courses, manage learner enrollments, and monitor current participation."
            : "Manage assigned cohorts and monitor participation for your learners."}
        </p>
        <ParishAdminNav />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Parish members</CardDescription>
            <CardTitle className="text-2xl">{overview.memberCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total enrollments</CardDescription>
            <CardTitle className="text-2xl">{overview.enrollmentCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active learners</CardDescription>
            <CardTitle className="text-2xl">{overview.activeLearnerCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stalled learners (31+ days)</CardDescription>
            <CardTitle className="text-2xl">{overview.stalledLearnerCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completion rate</CardDescription>
            <CardTitle className="text-2xl">{overview.completionRate}%</CardTitle>
          </CardHeader>
        </Card>
      </section>

      {role === "parish_admin" ? (
        <Card id="courses-section">
          <CardHeader>
            <CardTitle>Adopt Parish Courses</CardTitle>
            <CardDescription>
              Parish-scoped courses require explicit adoption before they can be assigned to parishioners.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <ParishCourseAdoptionManager
              adoptedCourses={adoptedParishCourses}
              availableCourses={availableParishCourses}
            />
          </CardContent>
        </Card>
      ) : null}

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
            cohorts={cohorts}
            courses={visibleCourses}
            members={members}
            participationRows={participationRows}
          />
        </CardContent>
      </Card>

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
            cohorts={cohorts}
            courses={visibleCourses}
            enrollments={enrollments}
            members={members}
          />
        </CardContent>
      </Card>

      {role === "parish_admin" ? (
        <Card id="enrollment-section">
          <CardHeader>
            <CardTitle>Enrollment Management</CardTitle>
            <CardDescription>
              Enroll parish members in visible courses and remove enrollments when needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <ParishEnrollmentManager courses={visibleCourses} enrollments={enrollments} members={members} />
          </CardContent>
        </Card>
      ) : null}

      {role === "parish_admin" ? (
        <Card id="communications-section">
          <CardHeader>
            <CardTitle>Communications</CardTitle>
            <CardDescription>
              Log nudges and announcements by audience while delivery integration is still pending.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <ParishCommunicationsManager
              cohorts={cohorts}
              courses={visibleCourses}
              prefill={communicationPrefill}
              sends={communicationSends}
            />
          </CardContent>
        </Card>
      ) : null}

      {role === "parish_admin" ? (
        <Card id="people-section">
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>
              Add existing platform users to this parish, update roles, and import memberships in bulk via CSV.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <ParishPeopleManager members={members} />
          </CardContent>
        </Card>
      ) : null}

      {role === "parish_admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Diocese-wide Courses</CardTitle>
            <CardDescription>These courses are already visible to your parish by diocesan policy.</CardDescription>
          </CardHeader>
          <CardContent>
            {dioceseCourses.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {dioceseCourses.map((course) => (
                  <li key={course.id}>
                    <span className="font-medium">{course.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No diocese-wide courses are currently published.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
