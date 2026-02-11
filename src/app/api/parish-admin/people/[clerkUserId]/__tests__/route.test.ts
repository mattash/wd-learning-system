import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, PATCH } from "@/app/api/parish-admin/people/[clerkUserId]/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/people/[clerkUserId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("updates a member role", async () => {
    const membershipSingle = vi.fn(async () => ({
      data: { parish_id: "p1", clerk_user_id: "user-1", role: "instructor" },
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ maybeSingle: membershipSingle }));
    const membershipEqUser = vi.fn(() => ({ select: membershipSelect }));
    const membershipEqParish = vi.fn(() => ({ eq: membershipEqUser }));
    const membershipUpdate = vi.fn(() => ({ eq: membershipEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update: membershipUpdate })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/parish-admin/people/user-1", {
        method: "PATCH",
        body: JSON.stringify({ role: "instructor" }),
      }),
      { params: Promise.resolve({ clerkUserId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      membership: { parish_id: "p1", clerk_user_id: "user-1", role: "instructor" },
    });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("removes a member", async () => {
    const eqUser = vi.fn(async () => ({ error: null }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const del = vi.fn(() => ({ eq: eqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ delete: del })),
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/people/user-1", { method: "DELETE" }),
      { params: Promise.resolve({ clerkUserId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("blocks self-removal", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/people/admin-1", { method: "DELETE" }),
      { params: Promise.resolve({ clerkUserId: "admin-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "You cannot remove your own parish membership." });
  });
});
