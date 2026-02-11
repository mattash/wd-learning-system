import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/admin-membership/route";

describe("POST /api/admin-membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("creates diocese admin and parish membership when requested", async () => {
    const dioceseUpsert = vi.fn(async () => ({ error: null }));
    const membershipUpsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: dioceseUpsert };
        if (table === "parish_memberships") return { upsert: membershipUpsert };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          parishId: "11111111-1111-4111-8111-111111111111",
          role: "instructor",
          makeDioceseAdmin: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dioceseUpsert).toHaveBeenCalledWith({ clerk_user_id: "user-2" });
    expect(membershipUpsert).toHaveBeenCalledWith(
      {
        parish_id: "11111111-1111-4111-8111-111111111111",
        clerk_user_id: "user-2",
        role: "instructor",
      },
      { onConflict: "parish_id,clerk_user_id" },
    );
  });

  it("returns 400 when diocese upsert fails", async () => {
    const dioceseUpsert = vi.fn(async () => ({ error: { message: "cannot promote" } }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: dioceseUpsert };
        if (table === "parish_memberships") return { upsert: vi.fn() };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          makeDioceseAdmin: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot promote" });
  });

  it("returns 400 when parish membership upsert fails", async () => {
    const membershipUpsert = vi.fn(async () => ({ error: { message: "invalid role" } }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: vi.fn() };
        if (table === "parish_memberships") return { upsert: membershipUpsert };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          parishId: "11111111-1111-4111-8111-111111111111",
          role: "student",
          makeDioceseAdmin: false,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid role" });
  });
});
