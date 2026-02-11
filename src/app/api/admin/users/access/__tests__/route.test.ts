import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { POST } from "@/app/api/admin/users/access/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("POST /api/admin/users/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("applies diocese admin and parish membership upserts", async () => {
    const upsertDiocese = vi.fn(async () => ({ error: null }));
    const upsertParishMembership = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: upsertDiocese, delete: vi.fn(() => ({ eq: vi.fn() })) };
        if (table === "parish_memberships") return { upsert: upsertParishMembership, delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })) };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-1",
          makeDioceseAdmin: true,
          parishId: "11111111-1111-4111-8111-111111111111",
          role: "parish_admin",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(upsertDiocese).toHaveBeenCalled();
    expect(upsertParishMembership).toHaveBeenCalled();
  });

  it("removes diocese admin and parish membership", async () => {
    const deleteDioceseEq = vi.fn(async () => ({ error: null }));
    const deleteParishEqUser = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") {
          return {
            upsert: vi.fn(),
            delete: vi.fn(() => ({ eq: deleteDioceseEq })),
          };
        }

        if (table === "parish_memberships") {
          return {
            upsert: vi.fn(),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({ eq: deleteParishEqUser })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-1",
          removeDioceseAdmin: true,
          parishId: "11111111-1111-4111-8111-111111111111",
          removeParishMembership: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteDioceseEq).toHaveBeenCalled();
    expect(deleteParishEqUser).toHaveBeenCalled();
  });

  it("returns 400 when diocese admin upsert fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: vi.fn(async () => ({ error: { message: "cannot promote" } })), delete: vi.fn() };
        if (table === "parish_memberships") return { upsert: vi.fn(), delete: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        body: JSON.stringify({ clerkUserId: "user-1", makeDioceseAdmin: true }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot promote" });
  });

  it("returns 400 when parish membership delete fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: vi.fn(), delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) };
        if (table === "parish_memberships") {
          return {
            upsert: vi.fn(),
            delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: { message: "cannot remove" } })) })) })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-1",
          parishId: "11111111-1111-4111-8111-111111111111",
          removeParishMembership: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot remove" });
  });
});
