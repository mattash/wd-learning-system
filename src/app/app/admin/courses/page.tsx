import { AdminCourseManager } from "@/components/admin-course-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCourses } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminCoursesPage() {
  const courses = await listCourses(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courses</CardTitle>
        <CardDescription>Create, update, publish, and delete courses from the diocesan catalog.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <AdminCourseManager courses={courses} />
      </CardContent>
    </Card>
  );
}
