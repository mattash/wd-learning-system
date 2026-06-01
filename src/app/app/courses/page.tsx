import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CourseThumbnail } from "@/components/learning/emblem";
import { ScopeBadge } from "@/components/learning/scope-badge";
import { CategoryChip } from "@/components/learning/meta-row";
import { ProgressLine } from "@/components/learning/progress-line";
import { placeholderCategory } from "@/components/learning/placeholders";
import { requireParishRole } from "@/lib/authz";
import { getStudentDashboardData } from "@/lib/repositories/dashboard";
import { listVisibleCourses } from "@/lib/repositories/courses";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const [{ progress }, visible] = await Promise.all([
    getStudentDashboardData(parishId, clerkUserId),
    listVisibleCourses(parishId),
  ]);
  const params = (await searchParams) ?? {};
  const showNotEnrolledMessage = params.error === "not_enrolled";

  const scopeByCourseId = new Map(visible.map((c) => [c.id, c.scope]));

  return (
    <div className="space-y-9">
      <header>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">
          My Courses
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Everything you&apos;re enrolled in, with your progress at a glance.
        </p>
      </header>

      {showNotEnrolledMessage && (
        <Card className="px-5 py-4">
          <p className="text-sm text-muted-foreground">
            You must be enrolled in a course before accessing lessons.
          </p>
        </Card>
      )}

      {progress.length === 0 && !showNotEnrolledMessage && (
        <Card className="px-6 py-12 text-center">
          <p className="text-[15px] font-medium">
            You are not enrolled in any courses yet.
          </p>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Ask your parish admin to enroll you to get started.
          </p>
        </Card>
      )}

      <div className="flex flex-col" style={{ rowGap: 18 }}>
        {progress.map((course) => {
          const scope = scopeByCourseId.get(course.courseId) ?? "DIOCESE";
          const category = placeholderCategory(course.courseId);
          const isStarted =
            course.progressPercent > 0 || course.lastActivityAt !== null;
          const targetHref = course.resumeLessonId
            ? `/app/lessons/${course.resumeLessonId}`
            : `/app/courses/${course.courseId}`;
          const courseHref = `/app/courses/${course.courseId}`;

          return (
            <Card
              key={course.courseId}
              className="flex flex-wrap items-center p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md sm:flex-nowrap"
              style={{ gap: 18 }}
            >
              <Link
                href={courseHref}
                className="flex min-w-0 flex-1 items-center gap-[18px]"
              >
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-[11px]">
                  <CourseThumbnail
                    alt={course.courseTitle}
                    seed={course.courseId}
                    thumbnailUrl={course.thumbnailUrl}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <CategoryChip category={category} />
                    <ScopeBadge scope={scope} />
                  </div>
                  <p className="font-display text-[16.5px] font-bold leading-snug">
                    {course.courseTitle}
                  </p>
                  {course.courseDescription && (
                    <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                      {course.courseDescription}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex w-full shrink-0 items-center justify-between gap-4 sm:w-auto sm:justify-start sm:gap-6">
                <div className="w-[200px]">
                  <ProgressLine percent={course.progressPercent} />
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    {course.completedLessons}/{course.totalLessons} lessons
                  </p>
                </div>
                <Button asChild size="sm" variant="default">
                  <Link href={targetHref}>
                    {isStarted ? "Resume" : "Start"}
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
