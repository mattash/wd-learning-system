import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/parish-communications/notifications", () => ({ notifyEnrollmentConfirmed: vi.fn() }));

import { DELETE, GET, POST } from "@/app/api/admin/enrollments/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { notifyEnrollmentConfirmed } from "@/lib/parish-communications/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(notifyEnrollmentConfirmed).mockResolvedValue();
  });

  it("lists enrollments", async () => {
    const limit = vi.fn(async () => ({ data: [{ id: "e1" }], error: null }));
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET(new Request("http://localhost/api/admin/enrollments"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enrollments: [{ id: "e1" }] });
  });

  it("creates enrollment", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eqCourse = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqCourse }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const existingSelect = vi.fn(() => ({ eq: eqParish }));
    const courseMaybeSingle = vi.fn(async () => ({ data: { id: "c1", scope: "DIOCESE" }, error: null }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));
    const single = vi.fn(async () => ({ data: { id: "e1" }, error: null }));
    const upsertSelect = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select: upsertSelect }));
    const rpc = vi.fn();

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "enrollments") return { select: existingSelect, upsert };
        if (table === "courses") return { select: courseSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc,
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          parishId: "11111111-1111-4111-8111-111111111111",
          courseId: "22222222-2222-4222-8222-222222222222",
          clerkUserId: "user-1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ enrollment: { id: "e1" } });
    expect(upsertSelect).toHaveBeenCalledWith("id,parish_id,clerk_user_id,course_id,created_at");
    expect(rpc).not.toHaveBeenCalled();
    expect(notifyEnrollmentConfirmed).toHaveBeenCalledWith({
      parishId: "11111111-1111-4111-8111-111111111111",
      courseId: "22222222-2222-4222-8222-222222222222",
      clerkUserId: "user-1",
    });
  });

  it("returns 200 without sending enrollment confirmation for existing enrollments", async () => {
    const existingEnrollment = {
      id: "e1",
      parish_id: "11111111-1111-4111-8111-111111111111",
      clerk_user_id: "user-1",
      course_id: "22222222-2222-4222-8222-222222222222",
      created_at: "2026-01-01",
    };
    const maybeSingle = vi.fn(async () => ({ data: existingEnrollment, error: null }));
    const eqCourse = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqCourse }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const existingSelect = vi.fn(() => ({ eq: eqParish }));
    const upsertSelect = vi.fn();
    const upsert = vi.fn(() => ({ select: upsertSelect }));
    const rpc = vi.fn();

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "enrollments") return { select: existingSelect, upsert };
        if (table === "courses") return { select: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc,
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          parishId: "11111111-1111-4111-8111-111111111111",
          courseId: "22222222-2222-4222-8222-222222222222",
          clerkUserId: "user-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enrollment: existingEnrollment });
    expect(upsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(notifyEnrollmentConfirmed).not.toHaveBeenCalled();
  });

  it("creates parish-scoped enrollments through the atomic adoption RPC", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eqCourse = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqCourse }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const existingSelect = vi.fn(() => ({ eq: eqParish }));
    const courseMaybeSingle = vi.fn(async () => ({ data: { id: "c1", scope: "PARISH" }, error: null }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));
    const upsert = vi.fn();
    const rpc = vi.fn(async () => ({
      data: {
        ok: true,
        enrollment: {
          id: "e1",
          parish_id: "11111111-1111-4111-8111-111111111111",
          clerk_user_id: "user-1",
          course_id: "22222222-2222-4222-8222-222222222222",
          created_at: "2026-01-01",
        },
      },
      error: null,
    }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "enrollments") return { select: existingSelect, upsert };
        if (table === "courses") return { select: courseSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
      rpc,
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          parishId: "11111111-1111-4111-8111-111111111111",
          courseId: "22222222-2222-4222-8222-222222222222",
          clerkUserId: "user-1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      enrollment: {
        id: "e1",
        parish_id: "11111111-1111-4111-8111-111111111111",
        clerk_user_id: "user-1",
        course_id: "22222222-2222-4222-8222-222222222222",
        created_at: "2026-01-01",
      },
    });
    expect(rpc).toHaveBeenCalledWith("create_parish_course_enrollment", {
      p_parish_id: "11111111-1111-4111-8111-111111111111",
      p_course_id: "22222222-2222-4222-8222-222222222222",
      p_clerk_user_id: "user-1",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid create payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          parishId: "not-a-uuid",
          courseId: "22222222-2222-4222-8222-222222222222",
          clerkUserId: "user-1",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid enrollment request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("deletes enrollment", async () => {
    const eqCourse = vi.fn(async () => ({ error: null }));
    const eqUser = vi.fn(() => ({ eq: eqCourse }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const del = vi.fn(() => ({ eq: eqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ delete: del })) } as never);

    const response = await DELETE(
      new Request("http://localhost/api/admin/enrollments", {
        method: "DELETE",
        body: JSON.stringify({
          parishId: "11111111-1111-4111-8111-111111111111",
          courseId: "22222222-2222-4222-8222-222222222222",
          clerkUserId: "user-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 400 for invalid delete payloads", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/admin/enrollments", {
        method: "DELETE",
        body: JSON.stringify({
          parishId: "11111111-1111-4111-8111-111111111111",
          clerkUserId: "user-1",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid enrollment request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
