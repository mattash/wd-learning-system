import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(() => false),
}));

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getStudentDashboardData } from "@/lib/repositories/dashboard";

function enrollmentsMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: returnData, error: null })),
      })),
    })),
  };
}

function modulesMock(returnData: unknown, inSpy = vi.fn()) {
  return {
    select: vi.fn(() => ({
      in: vi.fn((column: string, values: string[]) => {
        inSpy(column, values);
        return {
          order: vi.fn(async () => ({ data: returnData, error: null })),
        };
      }),
    })),
  };
}

function videoProgressMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ data: returnData, error: null })),
        })),
      })),
    })),
  };
}

function quizAttemptsMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: returnData, error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  };
}

function certificatesMock(count = 0) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ count, error: null })),
      })),
    })),
  };
}

describe("getStudentDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  it("excludes enrolled courses that are not visible to the parish", async () => {
    const modulesInSpy = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "enrollments") {
        return enrollmentsMock([
          {
            course_id: "course-visible",
            courses: {
              id: "course-visible",
              title: "Visible Course",
              description: "Available to parish",
              thumbnail_url: "/visible.png",
              duration_hours: 3,
              category: "Catechesis",
            },
          },
          {
            course_id: "course-hidden",
            courses: {
              id: "course-hidden",
              title: "Hidden Course",
              description: "No longer adopted",
              thumbnail_url: "/hidden.png",
              duration_hours: null,
              category: null,
            },
          },
        ]);
      }
      if (table === "modules") {
        return modulesMock(
          [
            {
              course_id: "course-visible",
              lessons: [{ id: "lesson-visible", title: "Visible Lesson" }],
            },
          ],
          modulesInSpy,
        );
      }
      if (table === "video_progress") {
        return videoProgressMock([
          {
            lesson_id: "lesson-visible",
            completed: true,
            last_position_seconds: 120,
            updated_at: new Date().toISOString(),
          },
        ]);
      }
      if (table === "quiz_attempts") {
        return quizAttemptsMock([]);
      }
      if (table === "certificates") {
        return certificatesMock(1);
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const rpc = vi.fn(async (name: string, params: { p_parish_id: string }) => {
      expect(name).toBe("get_visible_courses");
      expect(params).toEqual({ p_parish_id: "parish-1" });
      return {
        data: [{ id: "course-visible" }],
        error: null,
      };
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from, rpc } as never);

    const result = await getStudentDashboardData("parish-1", "user-1");

    expect(result.progress).toHaveLength(1);
    expect(result.progress[0]).toMatchObject({
      courseId: "course-visible",
      courseTitle: "Visible Course",
      completedLessons: 1,
      progressPercent: 100,
      durationHours: 3,
      category: "Catechesis",
    });
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0]).toMatchObject({
      lessonId: "lesson-visible",
      courseId: "course-visible",
    });
    expect(modulesInSpy).toHaveBeenCalledWith("course_id", ["course-visible"]);
    expect(from).not.toHaveBeenCalledWith("courses");
  });

  it("uses the first incomplete lesson as the resume target", async () => {
    const from = vi.fn((table: string) => {
      if (table === "enrollments") {
        return enrollmentsMock([
          {
            course_id: "course-visible",
            courses: {
              id: "course-visible",
              title: "Visible Course",
              description: null,
              thumbnail_url: null,
              duration_hours: null,
              category: null,
            },
          },
        ]);
      }
      if (table === "modules") {
        return modulesMock([
          {
            course_id: "course-visible",
            lessons: [
              { id: "lesson-complete", title: "Complete Lesson" },
              { id: "lesson-next", title: "Next Lesson" },
            ],
          },
        ]);
      }
      if (table === "video_progress") {
        return videoProgressMock([
          {
            lesson_id: "lesson-complete",
            completed: true,
            last_position_seconds: 120,
            updated_at: new Date().toISOString(),
          },
        ]);
      }
      if (table === "quiz_attempts") {
        return quizAttemptsMock([]);
      }
      if (table === "certificates") {
        return certificatesMock();
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const rpc = vi.fn(async () => ({
      data: [{ id: "course-visible" }],
      error: null,
    }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from, rpc } as never);

    const result = await getStudentDashboardData("parish-1", "user-1");

    expect(result.progress[0]).toMatchObject({
      completedLessons: 1,
      progressPercent: 50,
      resumeLessonId: "lesson-next",
      resumeLessonTitle: "Next Lesson",
    });
  });
});
