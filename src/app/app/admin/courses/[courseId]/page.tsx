import { notFound } from "next/navigation";

import { AdminCourseContentManager } from "@/components/admin-course-content-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseContentForAdmin } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminCourseContentPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const data = await getCourseContentForAdmin(courseId);

  if (!data) {
    notFound();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course content builder: {data.course.title}</CardTitle>
        <CardDescription>
          Build content with module cards, lesson cards, and a dedicated lesson page for question editing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdminCourseContentManager courseId={courseId} modules={data.modules} />
      </CardContent>
    </Card>
  );
}
