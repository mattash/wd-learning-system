import Link from "next/link";
import { notFound } from "next/navigation";

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
          <section key={module.id} className="rounded border bg-white p-4">
            <h2 className="font-semibold">{module.title}</h2>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {module.lessons?.map((lesson) => (
                <li key={lesson.id}>
                  <Link className="text-blue-700 underline" href={`/app/lessons/${lesson.id}`}>
                    {lesson.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
