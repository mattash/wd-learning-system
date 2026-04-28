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
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{tree.course.title}</h1>
        <p className="text-sm text-muted-foreground">
          {completedCount}/{allLessons.length} lessons complete ({progressPercent}%)
        </p>
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
                <li className="flex items-center" key={lesson.id}>
                  {statusIcon(lesson.status)}
                  <Button
                    asChild
                    className="h-auto p-0 font-medium"
                    variant="link"
                  >
                    <Link href={`/app/lessons/${lesson.id}`}>{lesson.title}</Link>
                  </Button>
                  {lesson.bestScore > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
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
