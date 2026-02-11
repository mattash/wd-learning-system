import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET } from "@/app/api/admin/reports/engagement/learners/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("GET /api/admin/reports/engagement/learners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("returns 400 without required params", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const res = await GET(new Request("http://localhost/api/admin/reports/engagement/learners"));
    expect(res.status).toBe(400);
  });

  it("returns learner progress", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "modules") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [{ lessons: [{ id: "l1" }, { id: "l2" }] }], error: null })),
            })),
          };
        }

        if (table === "enrollments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [{ clerk_user_id: "u1", created_at: "2024-01-01" }], error: null })),
              })),
            })),
          };
        }

        if (table === "video_progress") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  in: vi.fn(async () => ({ data: [{ clerk_user_id: "u1", lesson_id: "l1", completed: true }], error: null })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(
      new Request(
        "http://localhost/api/admin/reports/engagement/learners?parishId=11111111-1111-4111-8111-111111111111&courseId=22222222-2222-4222-8222-222222222222",
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      learners: [
        {
          clerk_user_id: "u1",
          enrolled_at: "2024-01-01",
          completed_lessons: 1,
          total_lessons: 2,
          progress_percent: 50,
        },
      ],
    });
  });

  it("returns empty list when course has no lessons", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "modules") {
          return {
            select: vi.fn(() => ({ eq: vi.fn(async () => ({ data: [{ lessons: [] }], error: null })) })),
          };
        }

        if (table === "enrollments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: [{ clerk_user_id: "u1", created_at: "2024-01-01" }], error: null })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(
      new Request(
        "http://localhost/api/admin/reports/engagement/learners?parishId=11111111-1111-4111-8111-111111111111&courseId=22222222-2222-4222-8222-222222222222",
      ),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ learners: [] });
  });

  it("returns 400 for invalid date range", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    const res = await GET(
      new Request(
        "http://localhost/api/admin/reports/engagement/learners?parishId=11111111-1111-4111-8111-111111111111&courseId=22222222-2222-4222-8222-222222222222&startDate=2024-02-10&endDate=2024-01-01",
      ),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid date range. Use YYYY-MM-DD and ensure startDate <= endDate.",
    });
  });
});
