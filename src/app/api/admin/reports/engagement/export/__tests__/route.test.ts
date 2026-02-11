import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET } from "@/app/api/admin/reports/engagement/export/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("GET /api/admin/reports/engagement/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("returns CSV export", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({ data: [{ parish_id: "p1", course_id: "c1", learners_started: 2, learners_completed: 1 }] })),
      from: vi.fn((table: string) => {
        if (table === "parishes") return { select: vi.fn(async () => ({ data: [{ id: "p1", name: "St A" }] })) };
        if (table === "courses") return { select: vi.fn(async () => ({ data: [{ id: "c1", title: "Course" }] })) };
        if (table === "enrollments") return { select: vi.fn(async () => ({ data: [{ parish_id: "p1", course_id: "c1" }] })) };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/admin/reports/engagement/export"));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("parish,course,enrollment_count");
    expect(body).toContain("\"St A\"");
  });

  it("filters rows for export", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [
          { parish_id: "p1", course_id: "c1", learners_started: 2, learners_completed: 1 },
          { parish_id: "p2", course_id: "c2", learners_started: 5, learners_completed: 4 },
        ],
      })),
      from: vi.fn((table: string) => {
        if (table === "parishes") {
          return { select: vi.fn(async () => ({ data: [{ id: "p1", name: "St A" }, { id: "p2", name: "St B" }] })) };
        }
        if (table === "courses") {
          return { select: vi.fn(async () => ({ data: [{ id: "c1", title: "Course A" }, { id: "c2", title: "Course B" }] })) };
        }
        if (table === "enrollments") {
          return {
            select: vi.fn(async () => ({ data: [{ parish_id: "p1", course_id: "c1" }, { parish_id: "p2", course_id: "c2" }] })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/admin/reports/engagement/export?parishId=p1&courseId=c1"));
    const body = await res.text();
    expect(body).toContain("\"St A\"");
    expect(body).not.toContain("\"St B\"");
  });

  it("handles zero-started rows", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({ data: [{ parish_id: "p1", course_id: "c1", learners_started: 0, learners_completed: 0 }] })),
      from: vi.fn((table: string) => {
        if (table === "parishes") return { select: vi.fn(async () => ({ data: [{ id: "p1", name: "St A" }] })) };
        if (table === "courses") return { select: vi.fn(async () => ({ data: [{ id: "c1", title: "Course" }] })) };
        if (table === "enrollments") return { select: vi.fn(async () => ({ data: [] })) };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const res = await GET(new Request("http://localhost/api/admin/reports/engagement/export"));
    const body = await res.text();
    expect(body).toContain('"0"');
  });

  it("returns 400 for invalid date filters", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/reports/engagement/export?startDate=2024-02-10&endDate=2024-01-01"),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "startDate must be before or equal to endDate" });
  });
});
