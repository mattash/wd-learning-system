import Link from "next/link";

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
          <Link key={course.id} className="rounded border bg-white p-4" href={`/app/courses/${course.id}`}>
            <h2 className="font-semibold">{course.title}</h2>
            <p className="text-sm text-slate-600">{course.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
