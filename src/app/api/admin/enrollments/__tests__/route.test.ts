import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, GET, POST } from "@/app/api/admin/enrollments/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
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
    const single = vi.fn(async () => ({ data: { id: "e1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ upsert })) } as never);

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
});
