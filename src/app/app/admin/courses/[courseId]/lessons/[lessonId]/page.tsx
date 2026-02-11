import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminLessonQuestionManager } from "@/components/admin-lesson-question-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseLessonContentForAdmin } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminLessonQuestionsPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const data = await getCourseLessonContentForAdmin(courseId, lessonId);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Button asChild size="sm" variant="outline">
        <Link href={`/app/admin/courses/${courseId}`}>Back to course builder</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Lesson question builder: {data.lesson.title}</CardTitle>
          <CardDescription>
            Course: {data.course.title} · Module: {data.module.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLessonQuestionManager lesson={data.lesson} />
        </CardContent>
      </Card>
    </div>
  );
}
