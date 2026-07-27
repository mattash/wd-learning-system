import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CourseThumbnail } from "@/components/learning/emblem";
import { CategoryChip, MetaRow } from "@/components/learning/meta-row";
import { PublicLearningHeader } from "@/components/public-learning-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="min-h-screen bg-background">
      <PublicLearningHeader current="course" />
      <main className="mx-auto max-w-[1160px] px-5 pb-16 pt-8 sm:px-7 sm:pt-10">
        <Link className="inline-flex items-center text-[13px] font-semibold text-muted-foreground transition-colors hover:text-primary" href="/catalog">
          <ArrowLeft aria-hidden="true" className="mr-2" size={16} strokeWidth={1.8} />
          All courses
        </Link>

        <header className="grid gap-10 border-b border-border pb-12 pt-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div className="order-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              {preview.course.scope === "DIOCESE" ? "Shared course" : "Parish course"}
            </p>
            {preview.course.category ? (
              <div className="mt-4">
                <CategoryChip category={preview.course.category} />
              </div>
            ) : null}
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              {preview.course.title}
            </h1>
            {preview.course.description ? (
              <p className="mt-5 max-w-[38rem] text-[17px] leading-relaxed text-muted-foreground">
                {preview.course.description}
              </p>
            ) : null}
            <MetaRow
              className="mt-6"
              duration={duration}
              instructor={preview.course.instructor}
              lessons={preview.lessonCount}
            />
            <Button asChild className="mt-8" size="lg">
              <Link href={`/sign-up?enrollCourseId=${encodeURIComponent(courseId)}`}>Register &amp; Enroll</Link>
            </Button>
          </div>
          <div className="order-1 aspect-square overflow-hidden rounded-[4px] border border-border bg-muted">
            <CourseThumbnail
              alt={preview.course.title}
              seed={preview.course.id}
              thumbnailUrl={preview.course.thumbnailUrl}
            />
          </div>
        </header>

        <section aria-labelledby="course-outline" className="max-w-[760px] pt-12">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">What you&apos;ll explore</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground" id="course-outline">Course outline</h2>
          {preview.modules.length > 0 ? (
            <div className="mt-7 grid gap-3">
              {preview.modules.map((module, index) => (
                <details className="group border border-border bg-card" key={module.id} open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-bold text-foreground marker:content-none sm:px-6">
                    <span>{module.title}</span>
                    <Plus aria-hidden="true" className="shrink-0 text-primary transition-transform group-open:rotate-45" size={18} strokeWidth={1.75} />
                  </summary>
                  <CardContent className="border-t border-border px-5 py-4 sm:px-6">
                    {module.lessons.length > 0 ? (
                      <ul className="space-y-2.5 text-[14px] text-muted-foreground">
                        {module.lessons.map((lesson) => (
                          <li className="flex items-start gap-3" key={lesson.id}>
                            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                            {lesson.title}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Lessons coming soon.</p>
                    )}
                  </CardContent>
                </details>
              ))}
            </div>
          ) : (
            <Card className="mt-7 rounded-none">
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">Course outline coming soon.</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
      <footer className="border-t border-border bg-secondary/60">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-2 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p>St. John Armenian Church Learning</p>
          <Link className="font-semibold text-foreground hover:text-primary" href="/sign-in">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
