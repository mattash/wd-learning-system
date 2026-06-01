import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { listEnrolledVisibleCourses } from "@/lib/repositories/courses";
import type { VisibleCourse } from "@/lib/repositories/courses";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const courses = await listEnrolledVisibleCourses(parishId, clerkUserId);
  const params = (await searchParams) ?? {};
  const showNotEnrolledMessage = params.error === "not_enrolled";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <div className="grid gap-3">
        {showNotEnrolledMessage ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                You must be enrolled in a course before accessing lessons.
              </p>
            </CardContent>
          </Card>
        ) : null}
        {courses.length === 0 ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                You are not enrolled in any courses yet. Ask your parish admin to enroll you.
              </p>
            </CardContent>
          </Card>
        ) : null}
        {(courses as VisibleCourse[]).map((course) => (
          <Link key={course.id} href={`/app/courses/${course.id}`}>
            <Card className="transition-colors hover:bg-secondary overflow-hidden">
              <CardContent className="flex items-center gap-3 py-3 sm:py-4">
                {/* Thumbnail */}
                <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {course.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={course.title}
                      className="h-full w-full object-cover"
                      src={course.thumbnailUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <svg className="h-7 w-7 sm:h-9 sm:w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm sm:text-base font-medium">{course.title}</p>
                  {course.description && (
                    <p className="hidden sm:block truncate text-xs sm:text-sm text-muted-foreground">
                      {course.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
