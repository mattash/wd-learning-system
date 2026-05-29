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

    const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "courses") return { select: courseSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc,
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/course-adoptions", {
        method: "DELETE",
        body: JSON.stringify({ courseId: "22222222-2222-4222-8222-222222222222" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("remove_course_adoption", {
      p_parish_id: "11111111-1111-4111-8111-111111111111",
      p_course_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when enrollments still exist for adopted course", async () => {
    const courseMaybeSingle = vi.fn(async () => ({
      data: { id: "c1", scope: "PARISH" },
      error: null,
    }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));

    const rpc = vi.fn(async () => ({
      data: { error: "Remove learner enrollments from this course before removing adoption.", code: "ENROLLMENTS_EXIST" },
      error: null,
    }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "courses") return { select: courseSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc,
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
