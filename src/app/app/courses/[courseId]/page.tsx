import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getCourseTreeWithProgress, isUserEnrolledInCourse } from "@/lib/repositories/courses";
import type { CourseLesson } from "@/lib/repositories/courses";

function statusIcon(status: CourseLesson["status"]) {
  switch (status) {
    case "completed":
      return <span className="mr-1.5" title="Completed">✓</span>;
    case "in_progress":
      return <span className="mr-1.5" title="In progress">▶</span>;
    default:
      return <span className="mr-1.5 text-muted-foreground" title="Not started">○</span>;
  }
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const { courseId } = await params;
  const enrolled = await isUserEnrolledInCourse({ parishId, clerkUserId, courseId });
  if (!enrolled) {
    redirect("/app/courses?error=not_enrolled");
  }

  const tree = await getCourseTreeWithProgress(courseId, parishId, clerkUserId);
  if (!tree) notFound();

  const allLessons = tree.modules.flatMap((m) => m.lessons);
  const completedCount = allLessons.filter((l) => l.status === "completed").length;
  const firstIncomplete = allLessons.find((l) => l.status !== "completed");
  const progressPercent = allLessons.length > 0
    ? Math.round((completedCount / allLessons.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-4">
        {/* Course thumbnail */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
          {tree.course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={tree.course.title}
              className="h-full w-full object-cover"
              src={tree.course.thumbnailUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
              </svg>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{tree.course.title}</h1>
          <p className="text-sm text-muted-foreground">
            {completedCount}/{allLessons.length} lessons complete ({progressPercent}%)
          </p>
        </div>
      </header>

      {/* Resume button */}
      {firstIncomplete && (
        <Button asChild>
          <Link href={`/app/lessons/${firstIncomplete.id}`}>
            {firstIncomplete.status === "in_progress" ? "Resume" : "Start"} next lesson
          </Link>
        </Button>
      )}

      {/* Progress bar */}
      {allLessons.length > 0 && (
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {tree.modules.map((module) => (
        <Card key={module.id}>
          <CardHeader>
            <CardTitle className="text-base">{module.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {module.lessons.map((lesson) => (
                <li className="flex items-center gap-3" key={lesson.id}>
                  {/* Lesson thumbnail */}
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted">
                    {lesson.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={lesson.title}
                        className="h-full w-full object-cover"
                        src={lesson.thumbnailUrl}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9v4a1 1 0 001.552.83l3.197-2.132a1 1 0 000-1.666z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                        </svg>
                      </div>
                    )}
                  </div>
                  {statusIcon(lesson.status)}
                  <Button
                    asChild
                    className="h-auto flex-1 justify-start p-0 font-medium"
                    variant="link"
                  >
                    <Link href={`/app/lessons/${lesson.id}`}>{lesson.title}</Link>
                  </Button>
                  {lesson.bestScore > 0 && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {lesson.bestScore}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {allLessons.length === 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              No lessons have been added to this course yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
