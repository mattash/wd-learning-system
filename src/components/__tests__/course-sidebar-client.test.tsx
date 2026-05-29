import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseSidebarClient } from "@/components/course-sidebar-client";
import type { CourseModuleWithProgress } from "@/lib/repositories/courses";

const modules: CourseModuleWithProgress[] = [
  {
    id: "module-1",
    title: "Module one",
    sort_order: 1,
    lessons: [
      {
        id: "lesson-1",
        title: "First lesson",
        sort_order: 1,
        content_type: "VIDEO",
        thumbnailUrl: null,
        status: "completed",
        bestScore: 100,
      },
      {
        id: "lesson-2",
        title: "Second lesson",
        sort_order: 2,
        content_type: "DOCUMENT",
        thumbnailUrl: null,
        status: "not_started",
        bestScore: 0,
      },
    ],
  },
];

describe("CourseSidebarClient", () => {
  it("closes the mobile outline when a lesson is selected", async () => {
    render(
      <CourseSidebarClient
        courseTitle="Course title"
        courseId="course-1"
        modules={modules}
        currentLessonId="lesson-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open course outline" }));

    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("link", { name: /Second lesson/ }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
