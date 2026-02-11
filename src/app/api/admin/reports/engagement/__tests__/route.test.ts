import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET } from "@/app/api/admin/reports/engagement/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("GET /api/admin/reports/engagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("returns filtered enriched rows", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [{ parish_id: "p1", course_id: "c1", learners_started: 10, learners_completed: 5 }],
        error: null,
      })),
      from: vi.fn((table: string) => {
        if (table === "parishes") return { select: vi.fn(async () => ({ data: [{ id: "p1", name: "St A" }], error: null })) };
        if (table === "courses") return { select: vi.fn(async () => ({ data: [{ id: "c1", title: "Course 1" }], error: null })) };
        if (table === "enrollments") return { select: vi.fn(async () => ({ data: [{ parish_id: "p1", course_id: "c1" }], error: null })) };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/admin/reports/engagement?parishId=p1&courseId=c1"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      rows: [
        {
          parish_id: "p1",
          course_id: "c1",
          learners_started: 10,
          learners_completed: 5,
          parish_name: "St A",
          course_title: "Course 1",
          enrollment_count: 1,
          completion_rate: 50,
        },
      ],
    });
  });

  it("returns 400 when metrics fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({ data: null, error: { message: "metrics failed" } })),
      from: vi.fn(() => ({ select: vi.fn(async () => ({ data: [], error: null })) })),
    } as never);

    const res = await GET(new Request("http://localhost/api/admin/reports/engagement"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "metrics failed" });
  });

  it("falls back to ids when labels are missing", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [{ parish_id: "p2", course_id: "c2", learners_started: 0, learners_completed: 0 }],
        error: null,
      })),
      from: vi.fn((table: string) => {
        if (table === "parishes") return { select: vi.fn(async () => ({ data: [], error: null })) };
        if (table === "courses") return { select: vi.fn(async () => ({ data: [], error: null })) };
        if (table === "enrollments") return { select: vi.fn(async () => ({ data: [], error: null })) };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/admin/reports/engagement"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      rows: [
        {
          parish_id: "p2",
          course_id: "c2",
          learners_started: 0,
          learners_completed: 0,
          parish_name: "p2",
          course_title: "c2",
          enrollment_count: 0,
          completion_rate: 0,
        },
      ],
    });
  });

  it("returns 400 for invalid date range", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/reports/engagement?startDate=2024-02-10&endDate=2024-01-01"),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "startDate must be before or equal to endDate",
    });
  });

  it("returns date-filtered rows with trends", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "modules") {
          return {
            select: vi.fn(async () => ({
              data: [{ course_id: "c1", lessons: [{ id: "l1" }, { id: "l2" }] }],
              error: null,
            })),
          };
        }

        if (table === "parishes") {
          return { select: vi.fn(async () => ({ data: [{ id: "p1", name: "St A" }], error: null })) };
        }

        if (table === "courses") {
          return { select: vi.fn(async () => ({ data: [{ id: "c1", title: "Course A" }], error: null })) };
        }

        if (table === "enrollments") {
          return {
            select: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(async () => ({
                  data: [
                    { parish_id: "p1", course_id: "c1", created_at: "2024-01-01T00:00:00.000Z" },
                    { parish_id: "p1", course_id: "c1", created_at: "2024-01-02T00:00:00.000Z" },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === "video_progress") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(async () => ({
                    data: [
                      {
                        parish_id: "p1",
                        clerk_user_id: "u1",
                        lesson_id: "l1",
                        completed: false,
                        updated_at: "2024-01-05T00:00:00.000Z",
                      },
                      {
                        parish_id: "p1",
                        clerk_user_id: "u1",
                        lesson_id: "l2",
                        completed: true,
                        updated_at: "2024-01-10T00:00:00.000Z",
                      },
                      {
                        parish_id: "p1",
                        clerk_user_id: "u2",
                        lesson_id: "l1",
                        completed: true,
                        updated_at: "2024-01-11T00:00:00.000Z",
                      },
                    ],
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(),
    } as never);

    const res = await GET(
      new Request(
        "http://localhost/api/admin/reports/engagement?startDate=2024-01-01&endDate=2024-01-31",
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      rows: [
        {
          parish_id: "p1",
          course_id: "c1",
          parish_name: "St A",
          course_title: "Course A",
          enrollment_count: 2,
          learners_started: 2,
          learners_completed: 2,
          completion_rate: 100,
        },
      ],
      trends: [
        {
          period: "2024-01",
          learners_started: 2,
          learners_completed: 2,
          completion_rate: 100,
        },
      ],
    });
  });
});
