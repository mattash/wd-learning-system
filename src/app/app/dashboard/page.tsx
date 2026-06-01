import Link from "next/link";

import { Card } from "@/components/ui/card";
import { CourseThumbnail } from "@/components/learning/emblem";
import { ProgressLine, ProgressRing } from "@/components/learning/progress-line";
import { MetaRow } from "@/components/learning/meta-row";
import { formatCourseDuration } from "@/lib/course-metadata";
import { requireParishRole } from "@/lib/authz";
import { getStudentDashboardData } from "@/lib/repositories/dashboard";
import type { LessonActivity } from "@/lib/repositories/dashboard";

function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function activityLabel(entry: LessonActivity) {
  if (entry.score !== null) return { label: `Quiz: ${entry.score}%`, kind: "quiz" as const };
  return { label: "Lesson completed", kind: "lesson" as const };
}

export default async function DashboardPage() {
  const { parishId, clerkUserId } = await requireParishRole("student");
  const { progress, recentActivity, dayStreak, certificatesEarned } = await getStudentDashboardData(
    parishId,
    clerkUserId,
  );

  const resumableCourses = progress
    .filter((c) => c.resumeLessonId && c.progressPercent < 100)
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt ?? 0).getTime() -
        new Date(a.lastActivityAt ?? 0).getTime(),
    );
  const activeResumeCourses = resumableCourses.filter((c) => c.lastActivityAt);

  const totalCompleted = progress.reduce((sum, c) => sum + c.completedLessons, 0);
  const totalLessons = progress.reduce((sum, c) => sum + c.totalLessons, 0);
  const continueCourse = resumableCourses[0];

  if (progress.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-[30px] font-bold tracking-tight">
          Dashboard
        </h1>
        <Card className="px-6 py-12 text-center">
          <p className="text-lg font-medium">
            You are not enrolled in any courses yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask your parish admin to enroll you to get started.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <header>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {totalCompleted} of {totalLessons} lessons completed across{" "}
          {progress.length} course{progress.length !== 1 ? "s" : ""}
        </p>
      </header>

      {/* Continue learning hero */}
      {continueCourse && (
        <Card className="grid overflow-hidden rounded-2xl grid-cols-1 sm:grid-cols-[280px_1fr]">
          <Link
            aria-label={`Resume ${continueCourse.resumeLessonTitle ?? continueCourse.courseTitle}`}
            className="relative block min-h-[180px] sm:min-h-[220px]"
            href={`/app/lessons/${continueCourse.resumeLessonId}`}
          >
            <CourseThumbnail
              alt={continueCourse.courseTitle}
              seed={continueCourse.courseId}
              thumbnailUrl={continueCourse.thumbnailUrl}
              className="absolute inset-0"
            />
          </Link>
          <div className="flex flex-col justify-center gap-3.5 px-7 py-7">
            <div className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] font-bold uppercase tracking-widest text-gold">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none" />
              </svg>
              Continue learning
            </div>
            <Link
              className="font-display text-[26px] font-bold leading-tight tracking-tight hover:text-primary"
              href={`/app/lessons/${continueCourse.resumeLessonId}`}
            >
              {continueCourse.resumeLessonTitle ?? "Resume next lesson"}
            </Link>
            <p className="m-0 text-[14.5px] text-muted-foreground">
              {continueCourse.courseTitle}
            </p>
            <ProgressLine className="max-w-[360px]" percent={continueCourse.progressPercent} />
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex items-center gap-2 rounded-[9px] bg-primary px-5 py-2.5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--ds-color-brand-hover)]"
                href={`/app/lessons/${continueCourse.resumeLessonId}`}
              >
                Resume lesson
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <span className="text-[13px] text-muted-foreground">
                {continueCourse.completedLessons}/{continueCourse.totalLessons} lessons complete
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Stat strip */}
      <div className="flex flex-wrap gap-3.5">
        <Stat
          icon={
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <path d="m3 13 9 5 9-5" />
            </svg>
          }
          tone="brand"
          num={totalCompleted}
          label="Lessons completed"
        />
        <Stat
          icon={
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" />
              <path d="M18 17H6a2 2 0 0 0-2 2" />
            </svg>
          }
          tone="gold"
          num={progress.length}
          label={`Active course${progress.length === 1 ? "" : "s"}`}
        />
        <Stat
          icon={
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 10 9 12 10 12c0-2 1-3 2-3 0-2-1-4 0-6Z" />
            </svg>
          }
          tone="ok"
          num={dayStreak}
          label="Day streak"
        />
        <Stat
          icon={
            <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="9" r="6" />
              <path d="M9 14l-1.5 7L12 19l4.5 2L15 14" />
            </svg>
          }
          tone="gold"
          num={certificatesEarned}
          label="Certificates"
        />
      </div>

      {/* Pick up where you left off */}
      {activeResumeCourses.length > 0 && (
        <section>
          <SectionHead title="Pick up where you left off" />
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            {activeResumeCourses.slice(0, 3).map((course) => (
              <Link
                href={`/app/lessons/${course.resumeLessonId}`}
                key={`resume-${course.courseId}`}
                className="group min-w-0"
              >
                <Card className="flex items-center gap-3.5 p-3.5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md">
                  <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[10px]">
                    <CourseThumbnail
                      alt={course.courseTitle}
                      seed={course.courseId}
                      thumbnailUrl={course.thumbnailUrl}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[14.5px] font-semibold leading-tight">
                      {course.resumeLessonTitle ?? "Resume"}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                      {course.courseTitle}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-primary">
                    Resume →
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Your courses */}
      <section>
        <SectionHead
          title="Your courses"
          link={{ href: "/app/courses", label: "View all" }}
        />
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
          {progress.map((course) => (
            <Link
              href={`/app/courses/${course.courseId}`}
              key={course.courseId}
              className="group min-w-0"
            >
              <Card className="flex items-center gap-4 p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md">
                <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl">
                  <CourseThumbnail
                    alt={course.courseTitle}
                    seed={course.courseId}
                    thumbnailUrl={course.thumbnailUrl}
                  />
                </div>
                <ProgressRing percent={course.progressPercent} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[16px] font-bold leading-tight">
                    {course.courseTitle}
                  </p>
                  {course.courseDescription && (
                    <p className="mt-1 line-clamp-1 text-[13px] text-muted-foreground">
                      {course.courseDescription}
                    </p>
                  )}
                  <MetaRow
                    className="mt-2.5"
                    lessons={course.totalLessons}
                    duration={formatCourseDuration(course.durationHours)}
                  />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <section>
          <SectionHead title="Recent activity" />
          <Card className="px-5 py-1">
            <ul>
              {recentActivity.map((entry, index) => {
                const { label, kind } = activityLabel(entry);
                return (
                  <li
                    className="flex items-center gap-3.5 border-b border-border py-3.5 last:border-0"
                    key={`${entry.lessonId}-${entry.activityAt}-${index}`}
                  >
                    <div
                      className={
                        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full " +
                        (kind === "quiz"
                          ? "bg-primary text-primary-foreground"
                          : "bg-success text-success-foreground")
                      }
                    >
                      {kind === "quiz" ? (
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="9" r="6" />
                          <path d="M9 14l-1.5 7L12 19l4.5 2L15 14" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m20 6-11 11-5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold">
                        {entry.lessonTitle}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {entry.courseTitle} · {label}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12.5px] text-muted-foreground">
                      {formatDate(entry.activityAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

function SectionHead({
  title,
  link,
}: {
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      {link && (
        <Link
          className="whitespace-nowrap text-[13px] font-semibold text-primary hover:underline"
          href={link.href}
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}

function Stat({
  icon,
  tone,
  num,
  label,
}: {
  icon: React.ReactNode;
  tone: "brand" | "gold" | "ok";
  num: number;
  label: string;
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-subtle text-primary"
      : tone === "gold"
        ? "bg-gold-subtle text-gold"
        : "bg-success-subtle text-success";
  return (
    <div className="flex min-w-[160px] flex-1 items-center gap-3.5 rounded-[13px] border border-border bg-card px-5 py-4">
      <div className={"grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] " + toneClass}>
        {icon}
      </div>
      <div>
        <div className="font-display text-[22px] font-bold leading-none">{num}</div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
