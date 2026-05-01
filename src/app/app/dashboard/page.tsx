import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getStudentDashboardData } from "@/lib/repositories/dashboard";
import type { LessonActivity } from "@/lib/repositories/dashboard";

function ProgressRing({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle
          className="text-muted stroke-current"
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeWidth="5"
        />
        <circle
          className="text-primary stroke-current transition-all duration-500 ease-out"
          cx="32"
          cy="32"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
      <span className="absolute text-sm font-semibold">{percent}%</span>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function activityIcon(
  entry: LessonActivity,
): { icon: string; label: string } {
  if (entry.score !== null) {
    return { icon: "📝", label: `Quiz: ${entry.score}%` };
  }
  return { icon: "✅", label: "Lesson completed" };
}

export default async function DashboardPage() {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const { progress, recentActivity } = await getStudentDashboardData(
    parishId,
    clerkUserId,
  );

  const inProgress = progress
    .filter((c) => c.lastLessonId)
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt ?? 0).getTime() -
        new Date(a.lastActivityAt ?? 0).getTime(),
    );

  const totalCompleted = progress.reduce(
    (sum, c) => sum + c.completedLessons,
    0,
  );
  const totalLessons = progress.reduce((sum, c) => sum + c.totalLessons, 0);

  if (progress.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-lg font-medium">
              You are not enrolled in any courses yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Ask your parish admin to enroll you to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {totalCompleted} of {totalLessons} lessons completed across{" "}
          {progress.length} course{progress.length !== 1 ? "s" : ""}
        </p>
      </header>

      {/* Continue where you left off */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Continue where you left off
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.slice(0, 3).map((course) => (
              <Link
                href={`/app/lessons/${course.lastLessonId}`}
                key={`resume-${course.courseId}`}
                className="min-w-0"
              >
                <Card className="h-full overflow-hidden transition-colors hover:bg-secondary">
                  <CardContent className="flex items-center gap-3 py-3">
                    {/* Course thumbnail */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {course.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={course.courseTitle}
                          className="h-full w-full object-cover"
                          src={course.thumbnailUrl}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {course.lastLessonTitle ?? "Resume"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {course.courseTitle}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-primary">
                      Resume →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Course progress */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Your courses
          </h2>
          <Link
            className="text-xs font-medium text-primary hover:underline"
            href="/app/courses"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {progress.map((course) => (
            <Link
              href={`/app/courses/${course.courseId}`}
              key={course.courseId}
              className="min-w-0"
            >
              <Card className="h-full overflow-hidden transition-colors hover:bg-secondary">
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Thumbnail */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {course.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={course.courseTitle}
                        className="h-full w-full object-cover"
                        src={course.thumbnailUrl}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                        </svg>
                      </div>
                    )}
                  </div>
                  <ProgressRing percent={course.progressPercent} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{course.courseTitle}</p>
                    {course.courseDescription && (
                      <p className="truncate text-xs text-muted-foreground">
                        {course.courseDescription}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course.completedLessons}/{course.totalLessons} lessons
                      complete
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Recent activity
          </h2>
          <Card>
            <CardContent className="py-2">
              <ul className="divide-y divide-border">
                {recentActivity.map((entry, index) => {
                  const { icon, label } = activityIcon(entry);
                  return (
                    <li
                      className="flex items-center gap-3 py-2.5"
                      key={`${entry.lessonId}-${entry.activityAt}-${index}`}
                    >
                      <span className="text-lg">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {entry.lessonTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.courseTitle} · {label}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(entry.activityAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href="/app/courses">View all courses</Link>
        </Button>
      </div>
    </div>
  );
}
