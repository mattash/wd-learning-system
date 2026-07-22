import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(() => false),
}));

import { isE2ESmokeMode } from "@/lib/e2e-mode";
import {
  getCourseTreeWithProgress,
  getPublicCoursePreview,
} from "@/lib/repositories/courses";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function courseMock(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn();
  const query = { eq, maybeSingle };
  eq.mockReturnValue(query);

  return {
    table: {
      select: vi.fn(() => query),
    },
    eq,
    maybeSingle,
  };
}

function modulesMock(result: { data: unknown; error: unknown }) {
  const order = vi.fn(async () => result);
  const eq = vi.fn(() => ({ order }));

  return {
    table: {
      select: vi.fn(() => ({ eq })),
    },
    eq,
    order,
  };
}

function courseMetadataMock() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: {}, error: null })),
      })),
    })),
  };
}

function progressQueryMock(returnData: unknown) {
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

const courseRow = {
  id: "course-1",
  title: "Public Course",
  description: "Course description",
  published: true,
  scope: "DIOCESE",
  thumbnail_url: "/course.png",
  instructor: "Instructor Name",
  duration_hours: "2.5",
  category: "Leadership",
};

describe("getPublicCoursePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  it("requires the requested course to be published and publicly browseable", async () => {
    const courses = courseMock({ data: courseRow, error: null });
    const modules = modulesMock({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === "courses") return courses.table;
      if (table === "modules") return modules.table;
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await getPublicCoursePreview("course-1");

    expect(courses.eq.mock.calls).toEqual([
      ["id", "course-1"],
      ["published", true],
      ["publicly_browseable", true],
    ]);
    expect(courses.maybeSingle).toHaveBeenCalledOnce();
  });

  it("returns null without querying modules when the course is hidden or missing", async () => {
    const courses = courseMock({ data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table === "courses") return courses.table;
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(getPublicCoursePreview("hidden-course")).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalledWith("modules");
  });

  it("maps a browseable course outline and counts its lessons", async () => {
    const courses = courseMock({ data: courseRow, error: null });
    const modules = modulesMock({
      data: [
        {
          id: "module-1",
          title: "Module One",
          sort_order: 1,
          lessons: [
            { id: "lesson-2", title: "Lesson Two", sort_order: 2 },
            { id: "lesson-1", title: "Lesson One", sort_order: 1 },
          ],
        },
        {
          id: "module-2",
          title: "Module Two",
          sort_order: 2,
          lessons: null,
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "courses") return courses.table;
      if (table === "modules") return modules.table;
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const result = await getPublicCoursePreview("course-1");

    expect(result).toEqual({
      course: {
        id: "course-1",
        title: "Public Course",
        description: "Course description",
        published: true,
        scope: "DIOCESE",
        thumbnailUrl: "/course.png",
        instructor: "Instructor Name",
        durationHours: 2.5,
        category: "Leadership",
      },
      modules: [
        {
          id: "module-1",
          title: "Module One",
          sort_order: 1,
          lessons: [
            { id: "lesson-1", title: "Lesson One", sort_order: 1 },
            { id: "lesson-2", title: "Lesson Two", sort_order: 2 },
          ],
        },
        {
          id: "module-2",
          title: "Module Two",
          sort_order: 2,
          lessons: [],
        },
      ],
      lessonCount: 2,
    });
    expect(modules.eq).toHaveBeenCalledWith("course_id", "course-1");
    expect(modules.order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("propagates course query errors without querying modules", async () => {
    const courseError = new Error("Course query failed");
    const courses = courseMock({ data: null, error: courseError });
    const from = vi.fn((table: string) => {
      if (table === "courses") return courses.table;
      throw new Error(`Unexpected table ${table}`);
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(getPublicCoursePreview("course-1")).rejects.toBe(courseError);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalledWith("modules");
  });
});

describe("getCourseTreeWithProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  it.each([
    {
      case: "completes a content-complete lesson without a quiz",
      questionCount: 0,
      quizAttempts: [] as number[],
      expectedStatus: "completed",
      expectedBestScore: 0,
    },
    {
      case: "keeps a quiz lesson below threshold in progress",
      questionCount: 1,
      quizAttempts: [79],
      expectedStatus: "in_progress",
      expectedBestScore: 79,
    },
    {
      case: "completes a quiz lesson at the threshold",
      questionCount: 1,
      quizAttempts: [80],
      expectedStatus: "completed",
      expectedBestScore: 80,
    },
    {
      case: "uses the best quiz attempt",
      questionCount: 1,
      quizAttempts: [40, 85, 60],
      expectedStatus: "completed",
      expectedBestScore: 85,
    },
  ])(
    "$case",
    async ({ questionCount, quizAttempts, expectedStatus, expectedBestScore }) => {
      const modules = modulesMock({
        data: [
          {
            id: "module-1",
            title: "Module One",
            sort_order: 1,
            lessons: [
              {
                id: "lesson-1",
                title: "Lesson One",
                sort_order: 1,
                content_type: "VIDEO",
                thumbnail_url: null,
                passing_score: 80,
                questions: Array.from({ length: questionCount }, (_, index) => ({
                  id: `question-${index + 1}`,
                })),
              },
            ],
          },
        ],
        error: null,
      });
      const from = vi.fn((table: string) => {
        if (table === "courses") return courseMetadataMock();
        if (table === "modules") return modules.table;
        if (table === "video_progress") {
          return progressQueryMock([
            {
              lesson_id: "lesson-1",
              completed: true,
              percent_watched: 100,
            },
          ]);
        }
        if (table === "quiz_attempts") {
          return progressQueryMock(
            quizAttempts.map((score) => ({ lesson_id: "lesson-1", score })),
          );
        }
        throw new Error(`Unexpected table ${table}`);
      });
      const rpc = vi.fn(async () => ({
        data: [courseRow],
        error: null,
      }));
      vi.mocked(getSupabaseAdminClient).mockReturnValue({ from, rpc } as never);

      const result = await getCourseTreeWithProgress(
        "course-1",
        "parish-1",
        "user-1",
      );

      expect(result?.modules[0].lessons[0]).toEqual({
        id: "lesson-1",
        title: "Lesson One",
        sort_order: 1,
        content_type: "VIDEO",
        thumbnailUrl: null,
        status: expectedStatus,
        bestScore: expectedBestScore,
      });
    },
  );
});
