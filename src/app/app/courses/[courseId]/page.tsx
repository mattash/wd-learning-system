import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getCourseTree } from "@/lib/repositories/courses";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { parishId } = await requireParishRole("student");
  const { courseId } = await params;
  const courseTree = await getCourseTree(courseId, parishId);

  if (!courseTree) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{courseTree.course.title}</h1>
      {courseTree.modules.map(
        (module: {
          id: string;
          title: string;
          lessons: { id: string; title: string }[];
        }) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="text-base">{module.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1">
                {module.lessons?.map((lesson) => (
                  <li key={lesson.id}>
                    <Button asChild className="h-auto p-0 font-medium" variant="link">
                      <Link href={`/app/lessons/${lesson.id}`}>{lesson.title}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}
