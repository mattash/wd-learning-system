import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/courses/route";
import { DELETE, PATCH } from "@/app/api/admin/courses/[courseId]/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("lists courses", async () => {
    const order = vi.fn(async () => ({ data: [{ id: "c1" }], error: null }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ courses: [{ id: "c1" }] });
  });

  it("returns 400 when list fails", async () => {
    const order = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
  });

  it("creates a course", async () => {
    const single = vi.fn(async () => ({ data: { id: "c1", title: "Course A", scope: "DIOCESE" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({ title: "Course A", description: null, scope: "DIOCESE", published: false }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ course: { id: "c1", title: "Course A", scope: "DIOCESE" } });
  });

  it("returns 400 when create fails", async () => {
    const single = vi.fn(async () => ({ data: null, error: { message: "bad payload" } }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({ title: "Course A", description: null, scope: "DIOCESE", published: false }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad payload" });
  });

  it("updates a course", async () => {
    const single = vi.fn(async () => ({ data: { id: "c1", title: "Updated" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/courses/c1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", description: null, scope: "PARISH", published: true }),
      }),
      { params: Promise.resolve({ courseId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ course: { id: "c1", title: "Updated" } });
  });

  it("returns 400 when update fails", async () => {
    const single = vi.fn(async () => ({ data: null, error: { message: "not found" } }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/courses/c1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", description: null, scope: "PARISH", published: true }),
      }),
      { params: Promise.resolve({ courseId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "not found" });
  });

  it("deletes a course", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ delete: del })),
    } as never);

    const response = await DELETE(new Request("http://localhost/api/admin/courses/c1", { method: "DELETE" }), {
      params: Promise.resolve({ courseId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 400 when delete fails", async () => {
    const eq = vi.fn(async () => ({ error: { message: "cannot delete" } }));
    const del = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ delete: del })),
    } as never);

    const response = await DELETE(new Request("http://localhost/api/admin/courses/c1", { method: "DELETE" }), {
      params: Promise.resolve({ courseId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot delete" });
  });
});
