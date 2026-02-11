import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { listEnrolledVisibleCourses } from "@/lib/repositories/courses";

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
        {(courses as Array<{ id: string; title: string; description: string | null }>).map((course) => (
          <Link key={course.id} href={`/app/courses/${course.id}`}>
            <Card className="transition-colors hover:bg-secondary">
              <CardHeader>
                <CardTitle className="text-base">{course.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{course.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
