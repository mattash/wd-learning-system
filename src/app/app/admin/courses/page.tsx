import { AdminCourseManager } from "@/components/admin-course-manager";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCourses } from "@/lib/repositories/diocese-admin";
import Link from "next/link";

export default async function DioceseAdminCoursesPage() {
  const courses = await listCourses(100);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Courses</CardTitle>
            <CardDescription>
              Create, update, publish, and remove courses from the diocesan catalog.
            </CardDescription>
          </div>
          <Button asChild size="sm" className="flex-shrink-0">
            <Link href="/app/admin/courses/new">+ Create course</Link>
          </Button>
        </div>
      </CardHeader>
      <div className="overflow-auto">
        <AdminCourseManager courses={courses} />
      </div>
    </Card>
  );
}