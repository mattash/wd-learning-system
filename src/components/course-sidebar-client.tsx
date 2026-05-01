"use client";

import { useState } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SheetTitle } from "@/components/ui/sheet";
import { CourseSidebar } from "@/components/course-sidebar";
import type { CourseModuleWithProgress } from "@/lib/repositories/courses";

interface CourseSidebarClientProps {
  courseTitle: string;
  courseId: string;
  modules: CourseModuleWithProgress[];
  currentLessonId: string;
}

export function CourseSidebarClient({
  courseTitle,
  courseId,
  modules,
  currentLessonId,
}: CourseSidebarClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed right-3 bottom-3 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open course outline"
      >
        <svg fill="none" height="18" stroke="currentColor" viewBox="0 0 24 24" width="18">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </button>

      {/* Desktop sidebar (always visible) */}
      <div className="hidden md:block">
        <CourseSidebar
          courseTitle={courseTitle}
          courseId={courseId}
          modules={modules}
          currentLessonId={currentLessonId}
        />
      </div>

      {/* Mobile sheet (slide-out) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right">
          {/* SheetTitle is required for Radix Dialog accessibility; sr-only since CourseSidebar renders its own header */}
          <SheetTitle className="sr-only">{courseTitle}</SheetTitle>
          {/* Scrollable container prevents clipping when lesson list is long */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CourseSidebar
              courseTitle={courseTitle}
              courseId={courseId}
              modules={modules}
              currentLessonId={currentLessonId}
              showHeader={false}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}