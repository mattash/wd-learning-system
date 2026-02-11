import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { POST, PUT } from "@/app/api/parish-admin/people/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/people branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("adds a member when identifier is a clerk_user_id", async () => {
    const userMaybeSingle = vi.fn(async () => ({
      data: { clerk_user_id: "user-1", email: "person@example.com", display_name: "Person" },
      error: null,
    }));
    const userEq = vi.fn(() => ({ maybeSingle: userMaybeSingle }));
    const userSelect = vi.fn(() => ({ eq: userEq }));

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
        body: JSON.stringify({ identifier: "user-1", role: "student" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(userEq).toHaveBeenCalledWith("clerk_user_id", "user-1");
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when no profile matches the identifier", async () => {
    const userLimit = vi.fn(async () => ({ data: [], error: null }));
    const userOrder = vi.fn(() => ({ limit: userLimit }));
    const userIlike = vi.fn(() => ({ order: userOrder }));
    const userSelect = vi.fn(() => ({ ilike: userIlike }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") return { select: userSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/people", {
        method: "POST",
        body: JSON.stringify({ identifier: "missing@example.com", role: "student" }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No existing platform account matches that identifier. Use an existing email or clerk_user_id.",
    });
  });

  it("returns 400 when membership upsert fails", async () => {
    const userLimit = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1", email: "person@example.com", display_name: "Person" }],
      error: null,
    }));
    const userOrder = vi.fn(() => ({ limit: userLimit }));
    const userIlike = vi.fn(() => ({ order: userOrder }));
    const userSelect = vi.fn(() => ({ ilike: userIlike }));

    const membershipSingle = vi.fn(async () => ({ data: null, error: { message: "write failed" } }));
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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "write failed" });
  });

  it("returns 400 when csv text has no data rows", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn() })),
    } as never);

    const response = await PUT(
      new Request("http://localhost/api/parish-admin/people", {
        method: "PUT",
        body: JSON.stringify({
          csvText: "   \n   ",
          defaultRole: "student",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "CSV is empty." });
  });

  it("imports a mixed csv and reports imported/skipped rows", async () => {
    let lookupEmail = "";
    const userLimit = vi.fn(async () => {
      if (lookupEmail === "error@example.com") {
        return { data: null, error: { message: "lookup failed" } };
      }
      if (lookupEmail === "missing@example.com") {
        return { data: [], error: null };
      }
      if (lookupEmail === "ok@example.com") {
        return {
          data: [{ clerk_user_id: "ok-user", email: "ok@example.com", display_name: "OK" }],
          error: null,
        };
      }
      if (lookupEmail === "fail@example.com") {
        return {
          data: [{ clerk_user_id: "fail-user", email: "fail@example.com", display_name: "Fail" }],
          error: null,
        };
      }
      return { data: [], error: null };
    });
    const userOrder = vi.fn(() => ({ limit: userLimit }));
    const userIlike = vi.fn((_column: string, value: string) => {
      lookupEmail = value;
      return { order: userOrder };
    });
    const userSelect = vi.fn(() => ({ ilike: userIlike }));

    const membershipUpsert = vi.fn(async (payload: { clerk_user_id: string }) => {
      if (payload.clerk_user_id === "fail-user") {
        return { error: { message: "membership save failed" } };
      }
      return { error: null };
    });

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
          csvText:
            "email,role\n,student\nerror@example.com,instructor\nmissing@example.com,student\nok@example.com,invalid-role\nfail@example.com,student",
          defaultRole: "instructor",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: {
        totalRows: 5,
        importedCount: 1,
        skippedCount: 4,
      },
      results: [
        {
          row: 2,
          identifier: "",
          role: "student",
          status: "skipped",
          message: "Missing identifier (email or clerk_user_id).",
        },
        {
          row: 3,
          identifier: "error@example.com",
          role: "instructor",
          status: "skipped",
          message: "lookup failed",
        },
        {
          row: 4,
          identifier: "missing@example.com",
          role: "student",
          status: "skipped",
          message: "No platform account found.",
        },
        {
          row: 5,
          identifier: "ok-user",
          role: "instructor",
          status: "imported",
          message: "Membership saved.",
        },
        {
          row: 6,
          identifier: "fail@example.com",
          role: "student",
          status: "skipped",
          message: "membership save failed",
        },
      ],
    });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });
});
