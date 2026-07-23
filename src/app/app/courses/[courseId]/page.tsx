import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CourseThumbnail } from "@/components/learning/emblem";
import { ScopeBadge } from "@/components/learning/scope-badge";
import { CategoryChip, MetaRow } from "@/components/learning/meta-row";
import { ProgressLine } from "@/components/learning/progress-line";
import { formatCourseDuration } from "@/lib/course-metadata";
import { requireParishRole } from "@/lib/authz";
import {
  getCourseTreeWithProgress,
  isUserEnrolledInCourse,
} from "@/lib/repositories/courses";
import type { CourseLesson } from "@/lib/repositories/courses";

function StatusDot({ status }: { status: CourseLesson["status"] }) {
  if (status === "completed") {
    return (
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m20 6-11 11-5-5" />
        </svg>
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" stroke="none">
          <path d="m10 9 5 3-5 3V9Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] border-border-strong" />
  );
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const { courseId } = await params;
  const enrolled = await isUserEnrolledInCourse({ parishId, clerkUserId, courseId });
  if (!enrolled) {
    redirect("/app/courses?error=not_enrolled");
  }

  const tree = await getCourseTreeWithProgress(courseId, parishId, clerkUserId);
  if (!tree) notFound();

  const allLessons = tree.modules.flatMap((m) => m.lessons);
  const completedCount = allLessons.filter((l) => l.status === "completed").length;
  const firstIncomplete = allLessons.find((l) => l.status !== "completed");
  const progressPercent =
    allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  const duration = formatCourseDuration(tree.course.durationHours);

  const lessonNumbers = new Map<string, number>();
  let n = 0;
  for (const m of tree.modules) {
    for (const l of m.lessons) {
      n += 1;
      lessonNumbers.set(l.id, n);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/app/catalog"
        className="inline-flex items-center text-[13px] font-semibold text-primary hover:underline"
      >
        ← Back to catalog
      </Link>

      {/* Hero */}
      <Card className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-[200px_1fr] sm:gap-7">
        <div className="aspect-square w-full max-w-[200px] self-start overflow-hidden rounded-[13px]">
          <CourseThumbnail
            alt={tree.course.title}
            seed={tree.course.id}
            thumbnailUrl={tree.course.thumbnailUrl ?? null}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {tree.course.category ? <CategoryChip category={tree.course.category} /> : null}
            <ScopeBadge scope={tree.course.scope} />
          </div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
            {tree.course.title}
          </h1>
          {tree.course.description && (
            <p className="m-0 max-w-[62ch] text-[15px] leading-relaxed text-[var(--ds-color-text-secondary)]">
              {tree.course.description}
            </p>
          )}
          <MetaRow
            lessons={allLessons.length}
            duration={duration}
            instructor={tree.course.instructor}
          />
          <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
            {firstIncomplete ? (
              <Button asChild size="lg">
                <Link href={`/app/lessons/${firstIncomplete.id}`}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
                  </svg>
                  {firstIncomplete.status === "in_progress"
                    ? "Resume next lesson"
                    : completedCount > 0
                      ? "Start next lesson"
                      : "Start course"}
                </Link>
              </Button>
            ) : allLessons.length > 0 ? (
              <span className="text-[14px] font-semibold text-success">
                ✓ Course complete
              </span>
            ) : null}
            <ProgressLine className="min-w-[220px]" percent={progressPercent} />
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col" style={{ rowGap: 18 }}>
          {tree.modules.map((module, mi) => (
            <Card key={module.id} className="overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-center gap-3 font-display text-[17px] font-bold">
                  <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-brand-subtle font-sans text-[12px] font-bold text-primary">
                    {mi + 1}
                  </span>
                  {module.title}
                </div>
                <span className="whitespace-nowrap text-[12.5px] font-medium text-muted-foreground">
                  {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul>
                {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/app/lessons/${lesson.id}`}
                        className="flex items-center gap-4 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-surface-raised"
                      >
                        <span className="w-[22px] shrink-0 text-[12px] text-muted-foreground">
                          {String(lessonNumbers.get(lesson.id) ?? 0).padStart(2, "0")}
                        </span>
                        <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg">
                          <CourseThumbnail
                            alt={lesson.title}
                            seed={`${tree.course.id}-${lesson.id}`}
                            thumbnailUrl={lesson.thumbnailUrl}
                          />
                        </div>
                        <StatusDot status={lesson.status} />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                          {lesson.title}
                        </span>
                        {lesson.bestScore > 0 && (
                          <span className="shrink-0 text-[12px] font-semibold text-success">
                            {lesson.bestScore}%
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}

          {allLessons.length === 0 && (
            <Card className="px-5 py-6">
              <p className="text-sm text-muted-foreground">
                No lessons have been added to this course yet.
              </p>
            </Card>
          )}
        </div>

        <aside>
          <Card className="sticky top-[80px] rounded-2xl p-6">
            <h3 className="mb-3.5 font-display text-[15px] font-bold">
              Course details
            </h3>
            <DetailRow label="Progress" value={`${completedCount}/${allLessons.length} (${progressPercent}%)`} />
            <DetailRow label="Lessons" value={String(allLessons.length)} />
            {duration ? <DetailRow label="Duration" value={duration} /> : null}
            {tree.course.instructor ? <DetailRow label="Instructor" value={tree.course.instructor} /> : null}
            <DetailRow label="Modules" value={String(tree.modules.length)} />
            <DetailRow
              label="Access"
              value={tree.course.scope === "DIOCESE" ? "Shared" : "Parish"}
            />
            <Button className="mt-4 w-full" variant="outline" disabled>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <circle cx="12" cy="9" r="6" />
                <path d="M9 14l-1.5 7L12 19l4.5 2L15 14" />
              </svg>
              View certificate
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 text-[13.5px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
