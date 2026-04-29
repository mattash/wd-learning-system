import { AdminCourseManager } from "@/components/admin-course-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCourses } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminCoursesPage() {
  const courses = await listCourses(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courses</CardTitle>
        <CardDescription>Create, update, publish, and remove courses from the diocesan catalog.</CardDescription>
      </CardHeader>
      <div className="overflow-auto">
        <AdminCourseManager courses={courses} />
      </div>
    </Card>
  );
}
