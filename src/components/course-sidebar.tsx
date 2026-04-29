"use client";

import Link from "next/link";

import type { CourseLesson, CourseModuleWithProgress } from "@/lib/repositories/courses";
import { ProgressBar } from "@/components/ui/progress-bar";

interface CourseSidebarProps {
  courseTitle: string;
  courseId: string;
  modules: CourseModuleWithProgress[];
  currentLessonId: string;
}

function lessonTypeIcon(contentType: CourseLesson["content_type"], isActive: boolean) {
  const color = isActive ? "text-primary" : "text-muted-foreground";
  if (contentType === "DOCUMENT") {
    return <span className={`text-[12px] ${color}`}>📄</span>;
  }
  return <span className={`text-[12px] ${color}`}>▶</span>;
}

export function CourseSidebar({ courseTitle, courseId, modules, currentLessonId }: CourseSidebarProps) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const completedCount = allLessons.filter((l) => l.status === "completed").length;
  const progressPercent = allLessons.length > 0
    ? Math.round((completedCount / allLessons.length) * 100)
    : 0;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar-bg transition-colors duration-250">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-[18px] pt-4 pb-3">
        <Link
          className="mb-2 block font-display text-[13.5px] font-bold leading-tight tracking-tight text-foreground hover:text-primary transition-colors"
          href={`/app/courses/${courseId}`}
        >
          {courseTitle}
        </Link>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{completedCount} of {allLessons.length} lessons complete</span>
            <span className="font-bold text-primary">{progressPercent}%</span>
          </div>
          <ProgressBar value={progressPercent} />
        </div>
      </div>

      {/* Scrollable lesson list */}
      <div className="flex-1 overflow-y-auto py-2">
        {modules.map((module) => (
          <div key={module.id}>
            <div className="px-[18px] pt-3 pb-[5px] text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              {module.title}
            </div>
            {module.lessons.map((lesson) => {
              const isActive = lesson.id === currentLessonId;
              const isCompleted = lesson.status === "completed";

              return (
                <Link
                  className={`flex items-center gap-2.5 border-l-[2.5px] px-[18px] py-[9px] transition-colors ${
                    isActive
                      ? "border-l-primary bg-brand-subtle"
                      : "border-l-transparent hover:bg-secondary"
                  }`}
                  href={`/app/lessons/${lesson.id}`}
                  key={lesson.id}
                >
                  {/* Completion icon */}
                  <div
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all ${
                      isCompleted
                        ? "border-success bg-success"
                        : isActive
                          ? "border-primary bg-primary"
                          : "border-border-strong bg-card"
                    }`}
                  >
                    {isCompleted ? (
                      <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      </svg>
                    ) : isActive ? (
                      <div className="h-[7px] w-[7px] rounded-full bg-primary-foreground" />
                    ) : null}
                  </div>

                  {/* Type icon */}
                  {lessonTypeIcon(lesson.content_type, isActive)}

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[13px] leading-tight ${
                        isActive
                          ? "font-bold text-primary"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {lesson.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {lesson.content_type === "DOCUMENT" ? "Document" : "Video"}
                      {lesson.bestScore > 0 ? ` · ${lesson.bestScore}%` : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
