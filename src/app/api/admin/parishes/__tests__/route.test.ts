import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/parishes/route";
import { DELETE, PATCH } from "@/app/api/admin/parishes/[parishId]/route";
import { POST as POST_ARCHIVE } from "@/app/api/admin/parishes/[parishId]/archive/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/parishes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("lists parishes", async () => {
    const order = vi.fn(async () => ({ data: [{ id: "p1" }], error: null }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ parishes: [{ id: "p1" }] });
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

  it("creates a parish", async () => {
    const single = vi.fn(async () => ({
      data: { id: "p1", name: "St Mary", slug: "st-mary", allow_self_signup: true, created_at: "now" },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/parishes", {
        method: "POST",
        body: JSON.stringify({ name: "St Mary", slug: "st-mary", allowSelfSignup: true }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      parish: { id: "p1", name: "St Mary", slug: "st-mary", allow_self_signup: true, created_at: "now" },
    });
  });

  it("returns 400 when create fails", async () => {
    const single = vi.fn(async () => ({ data: null, error: { message: "duplicate slug" } }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/parishes", {
        method: "POST",
        body: JSON.stringify({ name: "St Mary", slug: "st-mary", allowSelfSignup: true }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "duplicate slug" });
  });

  it("updates a parish", async () => {
    const single = vi.fn(async () => ({ data: { id: "p1", name: "St Mark" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/parishes/p1", {
        method: "PATCH",
        body: JSON.stringify({ name: "St Mark", slug: "st-mark", allowSelfSignup: false }),
      }),
      { params: Promise.resolve({ parishId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ parish: { id: "p1", name: "St Mark" } });
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
      new Request("http://localhost/api/admin/parishes/p1", {
        method: "PATCH",
        body: JSON.stringify({ name: "St Mark", slug: "st-mark", allowSelfSignup: false }),
      }),
      { params: Promise.resolve({ parishId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "not found" });
  });

  it("deletes a parish", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ delete: del })),
    } as never);

    const response = await DELETE(new Request("http://localhost/api/admin/parishes/p1", { method: "DELETE" }), {
      params: Promise.resolve({ parishId: "11111111-1111-4111-8111-111111111111" }),
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

    const response = await DELETE(new Request("http://localhost/api/admin/parishes/p1", { method: "DELETE" }), {
      params: Promise.resolve({ parishId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot delete" });
  });

  it("archives a parish", async () => {
    const single = vi.fn(async () => ({ data: { id: "p1", archived_at: "2024-01-01T00:00:00.000Z" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await POST_ARCHIVE(
      new Request("http://localhost/api/admin/parishes/p1/archive", {
        method: "POST",
        body: JSON.stringify({ archive: true }),
      }),
      { params: Promise.resolve({ parishId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      parish: { id: "p1", archived_at: "2024-01-01T00:00:00.000Z" },
    });
  });

  it("returns 400 when archive update fails", async () => {
    const single = vi.fn(async () => ({ data: null, error: { message: "cannot archive" } }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await POST_ARCHIVE(
      new Request("http://localhost/api/admin/parishes/p1/archive", {
        method: "POST",
        body: JSON.stringify({ archive: true }),
      }),
      { params: Promise.resolve({ parishId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot archive" });
  });
});
