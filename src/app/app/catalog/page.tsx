import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireParishRole } from "@/lib/authz";
import { getCatalogCourses } from "@/lib/repositories/catalog";
import { getStudentPendingRequests } from "@/lib/repositories/course-join-requests";
import type { CatalogCourse } from "@/lib/repositories/catalog";
import { RequestJoinButton } from "@/components/course-join/request-join-button";

function CourseCard({
  course,
  hasPendingRequest,
}: {
  course: CatalogCourse;
  hasPendingRequest: boolean;
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden transition-colors hover:bg-secondary/50">
      <div className="flex gap-3 p-4 pb-0">
        {/* Thumbnail */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={course.title}
              className="h-full w-full object-cover"
              src={course.thumbnailUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{course.title}</CardTitle>
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                course.scope === "DIOCESE"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-secondary-foreground",
              ].join(" ")}
            >
              {course.scope === "DIOCESE" ? "Diocese-wide" : "Parish"}
            </span>
          </div>
          {course.description && (
            <CardDescription className="line-clamp-2 mt-0.5">
              {course.description}
            </CardDescription>
          )}
        </div>
      </div>
      <CardContent className="mt-auto space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">
          {course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""}
        </p>
        {course.enrolled ? (
          <Button asChild className="w-full" variant="outline">
            <Link href={`/app/courses/${course.id}`}>Go to course</Link>
          </Button>
        ) : hasPendingRequest ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-success">Request sent</p>
            <p className="text-xs text-muted-foreground">Your parish admin will review it soon.</p>
          </div>
        ) : (
          <RequestJoinButton courseId={course.id} />
        )}
      </CardContent>
    </Card>
  );
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const allCourses = await getCatalogCourses(parishId, clerkUserId);
  const params = (await searchParams) ?? {};

  const rawQ = params.q;
  const query = Array.isArray(rawQ) ? rawQ[0] : (rawQ?.trim() ?? "");
  const enrollmentStatus = Array.isArray(params.enrollment) ? params.enrollment[0] : params.enrollment;
  const showEnrollmentConfirmation = enrollmentStatus === "requested";

  // Get pending join requests so we can show "Request sent" on course cards
  const pendingRequests = await getStudentPendingRequests({ parishId, clerkUserId });
  const pendingCourseIds = new Set(pendingRequests.map((r) => r.courseId));

  const enrolled = allCourses.filter((c) => c.enrolled);
  const unenrolled = allCourses.filter((c) => !c.enrolled);

  const filteredEnrolled =
    query.length > 0
      ? enrolled.filter(
          (c) =>
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
        )
      : enrolled;

  const filteredUnenrolled =
    query.length > 0
      ? unenrolled.filter(
          (c) =>
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            (c.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
        )
      : unenrolled;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Course Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Browse available courses and track your enrolled ones.
        </p>
      </header>

      {showEnrollmentConfirmation ? (
        <Alert>
          <AlertDescription>
            Your enrollment request has been submitted. A parish admin will review it shortly.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Search */}
      <form className="flex gap-2">
        <label className="sr-only" htmlFor="catalog-search">
          Search courses
        </label>
        <Input
          className="max-w-sm"
          defaultValue={query}
          id="catalog-search"
          name="q"
          placeholder="Search courses..."
          type="search"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query && (
          <Button asChild type="button" variant="ghost">
            <Link href="/app/catalog">Clear</Link>
          </Button>
        )}
      </form>

      {/* Enrolled courses */}
      {filteredEnrolled.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            My enrolled courses
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEnrolled.map((course) => (
              <CourseCard course={course} hasPendingRequest={pendingCourseIds.has(course.id)} key={course.id} />
            ))}
          </div>
        </section>
      )}

      {/* Available courses */}
      {filteredUnenrolled.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {query ? `Results for "${query}"` : "All available courses"}
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUnenrolled.map((course) => (
              <CourseCard course={course} hasPendingRequest={pendingCourseIds.has(course.id)} key={course.id} />
            ))}
          </div>
        </section>
      )}

      {/* Empty states */}
      {allCourses.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No courses are available in the catalog yet.
            </p>
          </CardContent>
        </Card>
      )}
      {allCourses.length > 0 &&
        filteredEnrolled.length === 0 &&
        filteredUnenrolled.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No courses match your search.
              </p>
            </CardContent>
          </Card>
        )}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/app/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
