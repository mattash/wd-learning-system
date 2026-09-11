import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RequestJoinButton } from "@/components/course-join/request-join-button";
import { CourseThumbnail } from "@/components/learning/emblem";
import { CategoryChip, MetaRow } from "@/components/learning/meta-row";
import { ScopeBadge } from "@/components/learning/scope-badge";
import { Card } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { formatCourseDuration } from "@/lib/course-metadata";
import {
  getCourseTree,
  isUserEnrolledInCourse,
} from "@/lib/repositories/courses";

export default async function CoursePreviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const { courseId } = await params;

  const enrolled = await isUserEnrolledInCourse({ parishId, clerkUserId, courseId });
  if (enrolled) {
    redirect(`/app/courses/${courseId}`);
  }

  const tree = await getCourseTree(courseId, parishId);
  if (!tree) notFound();

  const allLessons = tree.modules.flatMap((m) => m.lessons);
  const duration = formatCourseDuration(tree.course.durationHours);

  const lessonNumbers: Record<string, number> = {};
  let n = 0;
  for (const m of tree.modules) {
    for (const l of m.lessons) {
      n += 1;
      lessonNumbers[l.id] = n;
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
          <div className="mt-auto max-w-[260px] pt-1">
            <RequestJoinButton courseId={courseId} />
          </div>
        </div>
      </Card>

      {/* Outline */}
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
                <li
                  key={lesson.id}
                  className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-0"
                >
                  <span className="w-[22px] shrink-0 text-[12px] text-muted-foreground">
                    {String(lessonNumbers[lesson.id] ?? 0).padStart(2, "0")}
                  </span>
                  <div className="h-11 w-16 shrink-0 overflow-hidden rounded-lg">
                    <CourseThumbnail
                      alt={lesson.title}
                      seed={`${tree.course.id}-${lesson.id}`}
                      thumbnailUrl={lesson.thumbnail_url}
                    />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                    {lesson.title}
                  </span>
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
    </div>
  );
}
