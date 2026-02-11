import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { listVisibleCourses } from "@/lib/repositories/courses";

export default async function CoursesPage() {
  const { parishId } = await requireParishRole("student");
  const courses = await listVisibleCourses(parishId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <div className="grid gap-3">
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
