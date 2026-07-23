import { AdminCourseManager } from "@/components/admin-course-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDioceseAdmin } from "@/lib/authz";
import { listCourses } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminCoursesPage() {
  await requireDioceseAdmin();

  const courses = await listCourses(100);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Courses</CardTitle>
            <CardDescription>
              Create, update, publish, and remove courses from the shared catalog.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <div className="overflow-auto">
        <AdminCourseManager courses={courses} />
      </div>
    </Card>
  );
}
