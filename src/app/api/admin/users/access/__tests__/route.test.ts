import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  recordAdminAuditLog: vi.fn(),
}));

import { POST } from "@/app/api/admin/users/access/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("POST /api/admin/users/access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("applies diocese admin upserts", async () => {
    const upsertDiocese = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: upsertDiocese, delete: vi.fn(() => ({ eq: vi.fn() })) };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-1",
          makeDioceseAdmin: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(upsertDiocese).toHaveBeenCalled();
  });

  it("applies parish membership upserts", async () => {
    const upsertParishMembership = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") {
          return {
            upsert: upsertParishMembership,
            delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })),
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
          role: "parish_admin",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(upsertParishMembership).toHaveBeenCalled();
  });

  it("removes parish membership", async () => {
    const deleteParishEqUser = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
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
          parishId: "11111111-1111-4111-8111-111111111111",
          removeParishMembership: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteParishEqUser).toHaveBeenCalled();
  });

  it("rejects compound access changes before any write or audit log", async () => {
    const from = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Only one access change may be requested at a time" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(recordAdminAuditLog).not.toHaveBeenCalled();
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
