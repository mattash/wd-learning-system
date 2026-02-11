import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { POST, PUT } from "@/app/api/parish-admin/people/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/people", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("adds a member by email", async () => {
    const userLimit = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1", email: "person@example.com", display_name: "Person" }],
      error: null,
    }));
    const userOrder = vi.fn(() => ({ limit: userLimit }));
    const userIlike = vi.fn(() => ({ order: userOrder }));
    const userSelect = vi.fn(() => ({ ilike: userIlike }));

    const membershipSingle = vi.fn(async () => ({ data: { clerk_user_id: "user-1", role: "student" }, error: null }));
    const membershipSelect = vi.fn(() => ({ single: membershipSingle }));
    const membershipUpsert = vi.fn(() => ({ select: membershipSelect }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") return { select: userSelect };
        if (table === "parish_memberships") return { upsert: membershipUpsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/people", {
        method: "POST",
        body: JSON.stringify({ identifier: "person@example.com", role: "student" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      membership: { clerk_user_id: "user-1", role: "student" },
      user: { clerk_user_id: "user-1", email: "person@example.com", display_name: "Person" },
    });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("imports memberships from csv", async () => {
    const userLimit = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1", email: "person@example.com", display_name: "Person" }],
      error: null,
    }));
    const userOrder = vi.fn(() => ({ limit: userLimit }));
    const userIlike = vi.fn(() => ({ order: userOrder }));
    const userSelect = vi.fn(() => ({ ilike: userIlike }));

    const membershipUpsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") return { select: userSelect };
        if (table === "parish_memberships") return { upsert: membershipUpsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PUT(
      new Request("http://localhost/api/parish-admin/people", {
        method: "PUT",
        body: JSON.stringify({
          csvText: "email,role\nperson@example.com,student",
          defaultRole: "student",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: {
        totalRows: 1,
        importedCount: 1,
        skippedCount: 0,
      },
      results: [
        {
          row: 2,
          identifier: "user-1",
          role: "student",
          status: "imported",
          message: "Membership saved.",
        },
      ],
    });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when csv header is missing required columns", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn() })),
    } as never);

    const response = await PUT(
      new Request("http://localhost/api/parish-admin/people", {
        method: "PUT",
        body: JSON.stringify({
          csvText: "name,role\nperson,student",
          defaultRole: "student",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "CSV header must include either clerk_user_id or email.",
    });
  });
});
