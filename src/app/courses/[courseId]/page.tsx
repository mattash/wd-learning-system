import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasCompletedOnboarding, requireActiveParish } from "@/lib/authz";
import { formatCourseDuration } from "@/lib/course-metadata";
import { getPublicCoursePreview, isUserEnrolledInCourse } from "@/lib/repositories/courses";

export default async function PublicCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  // Reject non-UUID courseId before querying Supabase (prevents 500 from PostgreSQL 22P02)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)) notFound();

  const preview = await getPublicCoursePreview(courseId);
  if (!preview) notFound();
  const duration = formatCourseDuration(preview.course.durationHours);

  const { userId } = await auth();
  if (userId) {
    if (!(await hasCompletedOnboarding(userId))) {
      redirect(`/app/onboarding?enrollCourseId=${encodeURIComponent(courseId)}`);
    }

    const parishId = await requireActiveParish(userId);
    const enrolled = await isUserEnrolledInCourse({ parishId, clerkUserId: userId, courseId });
    redirect(enrolled ? `/app/courses/${courseId}` : `/app/catalog?courseId=${encodeURIComponent(courseId)}`);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-md border bg-muted">
          {preview.course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={preview.course.title}
              className="h-full w-full object-cover"
              src={preview.course.thumbnailUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Course
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {preview.course.scope === "DIOCESE" ? "Shared course" : "Parish course"}
            </p>
            <h1 className="text-3xl font-semibold">{preview.course.title}</h1>
          </div>
          {preview.course.description ? (
            <p className="max-w-2xl text-muted-foreground">{preview.course.description}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {[
              preview.course.category,
              duration,
              preview.course.instructor,
              `${preview.modules.length} module${preview.modules.length !== 1 ? "s" : ""}`,
              `${preview.lessonCount} lesson${preview.lessonCount !== 1 ? "s" : ""}`,
            ].filter(Boolean).join(" · ")}
          </p>
          <Button asChild>
            <Link href={`/sign-up?enrollCourseId=${encodeURIComponent(courseId)}`}>Register & Enroll</Link>
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Course outline</h2>
        {preview.modules.length > 0 ? (
          <div className="grid gap-3">
            {preview.modules.map((module) => (
              <Card key={module.id}>
                <CardHeader>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {module.lessons.length > 0 ? (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>{lesson.title}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Lessons coming soon.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Course outline coming soon.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
