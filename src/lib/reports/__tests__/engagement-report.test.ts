import { describe, expect, it } from "vitest";
import {
  getDateRangeBounds,
  hasDateFilters,
  loadEngagementReportData,
  parseEngagementFilters,
} from "@/lib/reports/engagement-report";

describe("parseEngagementFilters", () => {
  it("returns empty filters when no params provided", () => {
    const result = parseEngagementFilters(new URLSearchParams());
    expect(result.ok).toBe(true);
    expect(result).toEqual({ ok: true, filters: {} });
  });

  it("parses all valid filter params", () => {
    const result = parseEngagementFilters(
      new URLSearchParams("parishId=p1&courseId=c1&startDate=2024-01-01&endDate=2024-12-31"),
    );
    expect(result).toEqual({
      ok: true,
      filters: { parishId: "p1", courseId: "c1", startDate: "2024-01-01", endDate: "2024-12-31" },
    });
  });

  it("returns error for invalid startDate format", () => {
    const result = parseEngagementFilters(new URLSearchParams("startDate=not-a-date"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("startDate");
    }
  });

  it("returns error for invalid endDate format", () => {
    const result = parseEngagementFilters(new URLSearchParams("endDate=not-a-date"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("endDate");
    }
  });

  it("returns error when startDate is after endDate", () => {
    const result = parseEngagementFilters(
      new URLSearchParams("startDate=2024-12-31&endDate=2024-01-01"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("startDate");
    }
  });

  it("allows startDate equal to endDate", () => {
    const result = parseEngagementFilters(
      new URLSearchParams("startDate=2024-06-15&endDate=2024-06-15"),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid calendar date", () => {
    const result = parseEngagementFilters(new URLSearchParams("startDate=2024-02-30"));
    expect(result.ok).toBe(false);
  });

  it("accepts leap year feb 29", () => {
    const result = parseEngagementFilters(new URLSearchParams("startDate=2024-02-29"));
    expect(result.ok).toBe(true);
  });

  it("rejects feb 29 in non-leap year", () => {
    const result = parseEngagementFilters(new URLSearchParams("startDate=2025-02-29"));
    expect(result.ok).toBe(false);
  });

  it("allows startDate without endDate", () => {
    const result = parseEngagementFilters(new URLSearchParams("startDate=2024-01-01"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.startDate).toBe("2024-01-01");
    }
  });

  it("allows endDate without startDate", () => {
    const result = parseEngagementFilters(new URLSearchParams("endDate=2024-12-31"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.endDate).toBe("2024-12-31");
    }
  });
});

describe("hasDateFilters", () => {
  it("returns false when both dates are undefined", () => {
    expect(hasDateFilters({})).toBe(false);
  });

  it("returns true when only startDate is set", () => {
    expect(hasDateFilters({ startDate: "2024-01-01" })).toBe(true);
  });

  it("returns true when only endDate is set", () => {
    expect(hasDateFilters({ endDate: "2024-12-31" })).toBe(true);
  });

  it("returns true when both dates are set", () => {
    expect(hasDateFilters({ startDate: "2024-01-01", endDate: "2024-12-31" })).toBe(true);
  });
});

describe("getDateRangeBounds", () => {
  it("returns null when no date filters", () => {
    expect(getDateRangeBounds({})).toBeNull();
  });

  it("returns correct bounds when only startDate is set", () => {
    const result = getDateRangeBounds({ startDate: "2024-06-15" });
    expect(result).toEqual({
      startAt: "2024-06-15T00:00:00.000Z",
      endAt: "9999-12-31T23:59:59.999Z",
    });
  });

  it("returns correct bounds when only endDate is set", () => {
    const result = getDateRangeBounds({ endDate: "2024-12-31" });
    expect(result).toEqual({
      startAt: "1970-01-01T00:00:00.000Z",
      endAt: "2024-12-31T23:59:59.999Z",
    });
  });

  it("returns correct bounds when both dates are set", () => {
    const result = getDateRangeBounds({ startDate: "2024-01-01", endDate: "2024-12-31" });
    expect(result).toEqual({
      startAt: "2024-01-01T00:00:00.000Z",
      endAt: "2024-12-31T23:59:59.999Z",
    });
  });
});

describe("loadEngagementReportData", () => {
  it("requires all course lessons before counting a date-filtered learner as completed", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "modules") {
          return {
            select: async () => ({
              data: [
                {
                  course_id: "course-1",
                  lessons: [{ id: "lesson-1" }, { id: "lesson-2" }],
                },
              ],
              error: null,
            }),
          };
        }

        if (table === "parishes") {
          return { select: async () => ({ data: [{ id: "parish-1", name: "St A" }], error: null }) };
        }

        if (table === "courses") {
          return { select: async () => ({ data: [{ id: "course-1", title: "Course A" }], error: null }) };
        }

        if (table === "enrollments") {
          const query = {
            eq: () => query,
            gte: () => query,
            lte: async () => ({
              data: [{ parish_id: "parish-1", course_id: "course-1", created_at: "2024-01-01T00:00:00.000Z" }],
              error: null,
            }),
          };
          return { select: () => query };
        }

        if (table === "video_progress") {
          const query = {
            eq: () => query,
            in: () => query,
            gte: () => query,
            lte: async () => ({
              data: [
                {
                  parish_id: "parish-1",
                  clerk_user_id: "learner-1",
                  lesson_id: "lesson-1",
                  completed: true,
                  updated_at: "2024-01-15T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          };
          return { select: () => query };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const result = await loadEngagementReportData(supabase as never, {
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.rows).toEqual([
      {
        parish_id: "parish-1",
        course_id: "course-1",
        parish_name: "St A",
        course_title: "Course A",
        enrollment_count: 1,
        learners_started: 1,
        learners_completed: 0,
        completion_rate: 0,
      },
    ]);
    expect(result.data?.trends).toEqual([
      {
        period: "2024-01",
        learners_started: 1,
        learners_completed: 0,
        completion_rate: 0,
      },
    ]);
  });

  it("counts date-filtered learners as completed after all course lessons are completed", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "modules") {
          return {
            select: async () => ({
              data: [
                {
                  course_id: "course-1",
                  lessons: [{ id: "lesson-1" }, { id: "lesson-2" }],
                },
              ],
              error: null,
            }),
          };
        }

        if (table === "parishes") {
          return { select: async () => ({ data: [{ id: "parish-1", name: "St A" }], error: null }) };
        }

        if (table === "courses") {
          return { select: async () => ({ data: [{ id: "course-1", title: "Course A" }], error: null }) };
        }

        if (table === "enrollments") {
          const query = {
            eq: () => query,
            gte: () => query,
            lte: async () => ({
              data: [{ parish_id: "parish-1", course_id: "course-1", created_at: "2024-01-01T00:00:00.000Z" }],
              error: null,
            }),
          };
          return { select: () => query };
        }

        if (table === "video_progress") {
          const query = {
            eq: () => query,
            in: () => query,
            gte: () => query,
            lte: async () => ({
              data: [
                {
                  parish_id: "parish-1",
                  clerk_user_id: "learner-1",
                  lesson_id: "lesson-1",
                  completed: true,
                  updated_at: "2024-01-15T00:00:00.000Z",
                },
                {
                  parish_id: "parish-1",
                  clerk_user_id: "learner-1",
                  lesson_id: "lesson-2",
                  completed: true,
                  updated_at: "2024-01-16T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          };
          return { select: () => query };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const result = await loadEngagementReportData(supabase as never, {
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });

    expect(result.data?.rows[0]?.learners_completed).toBe(1);
    expect(result.data?.rows[0]?.completion_rate).toBe(100);
    expect(result.data?.trends[0]?.learners_completed).toBe(1);
    expect(result.data?.trends[0]?.completion_rate).toBe(100);
  });
});
