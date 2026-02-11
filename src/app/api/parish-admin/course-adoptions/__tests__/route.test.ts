import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, POST } from "@/app/api/parish-admin/course-adoptions/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/course-adoptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("adopts a parish-scoped course", async () => {
    const courseMaybeSingle = vi.fn(async () => ({
      data: { id: "c1", scope: "PARISH", published: true },
      error: null,
    }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));

    const upsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "courses") return { select: courseSelect };
        if (table === "course_parishes") return { upsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/course-adoptions", {
        method: "POST",
        body: JSON.stringify({ courseId: "22222222-2222-4222-8222-222222222222" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        parish_id: "11111111-1111-4111-8111-111111111111",
        course_id: "22222222-2222-4222-8222-222222222222",
      },
      { onConflict: "course_id,parish_id" },
    );
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("removes adoption when no enrollments exist", async () => {
    const courseMaybeSingle = vi.fn(async () => ({
      data: { id: "c1", scope: "PARISH" },
      error: null,
    }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));

    const enrollmentEqCourse = vi.fn(async () => ({ count: 0, error: null }));
    const enrollmentEqParish = vi.fn(() => ({ eq: enrollmentEqCourse }));
    const enrollmentSelect = vi.fn(() => ({ eq: enrollmentEqParish }));

    const deleteEqCourse = vi.fn(async () => ({ error: null }));
    const deleteEqParish = vi.fn(() => ({ eq: deleteEqCourse }));
    const del = vi.fn(() => ({ eq: deleteEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "courses") return { select: courseSelect };
        if (table === "enrollments") return { select: enrollmentSelect };
        if (table === "course_parishes") return { delete: del };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/course-adoptions", {
        method: "DELETE",
        body: JSON.stringify({ courseId: "22222222-2222-4222-8222-222222222222" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when enrollments still exist for adopted course", async () => {
    const courseMaybeSingle = vi.fn(async () => ({
      data: { id: "c1", scope: "PARISH" },
      error: null,
    }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));

    const enrollmentEqCourse = vi.fn(async () => ({ count: 2, error: null }));
    const enrollmentEqParish = vi.fn(() => ({ eq: enrollmentEqCourse }));
    const enrollmentSelect = vi.fn(() => ({ eq: enrollmentEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "courses") return { select: courseSelect };
        if (table === "enrollments") return { select: enrollmentSelect };
        if (table === "course_parishes") return { delete: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/course-adoptions", {
        method: "DELETE",
        body: JSON.stringify({ courseId: "22222222-2222-4222-8222-222222222222" }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Remove learner enrollments from this course before removing adoption.",
    });
  });
});
