import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET, POST } from "@/app/api/parish-admin/cohorts/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/cohorts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("lists cohorts for active parish", async () => {
    const limit = vi.fn(async () => ({ data: [{ id: "cohort-1", name: "RCIA" }], error: null }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cohorts: [{ id: "cohort-1", name: "RCIA" }] });
  });

  it("limits cohort list to assigned facilitator cohorts for instructors", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "instructor-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "instructor",
    });

    const limit = vi.fn(async () => ({ data: [{ id: "cohort-1" }], error: null }));
    const facilitatorEq = vi.fn(() => ({ limit }));
    const order = vi.fn(() => ({ eq: facilitatorEq }));
    const parishEq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq: parishEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cohorts: [{ id: "cohort-1" }] });
    expect(facilitatorEq).toHaveBeenCalledWith("facilitator_clerk_user_id", "instructor-1");
  });

  it("creates a cohort", async () => {
    const membershipMaybeSingle = vi.fn(async () => ({ data: { role: "instructor" }, error: null }));
    const membershipEqUser = vi.fn(() => ({ maybeSingle: membershipMaybeSingle }));
    const membershipEqParish = vi.fn(() => ({ eq: membershipEqUser }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEqParish }));

    const cohortSingle = vi.fn(async () => ({ data: { id: "cohort-1", name: "RCIA A" }, error: null }));
    const cohortSelect = vi.fn(() => ({ single: cohortSingle }));
    const cohortInsert = vi.fn(() => ({ select: cohortSelect }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "cohorts") return { insert: cohortInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/cohorts", {
        method: "POST",
        body: JSON.stringify({
          name: "RCIA A",
          facilitatorClerkUserId: "facilitator-1",
          cadence: "weekly",
          nextSessionAt: "2026-02-20T19:00:00.000Z",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ cohort: { id: "cohort-1", name: "RCIA A" } });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when facilitator is not eligible", async () => {
    const membershipMaybeSingle = vi.fn(async () => ({ data: { role: "student" }, error: null }));
    const membershipEqUser = vi.fn(() => ({ maybeSingle: membershipMaybeSingle }));
    const membershipEqParish = vi.fn(() => ({ eq: membershipEqUser }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "cohorts") return { insert: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/cohorts", {
        method: "POST",
        body: JSON.stringify({
          name: "RCIA A",
          facilitatorClerkUserId: "student-1",
          cadence: "weekly",
          nextSessionAt: null,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Facilitator must be a parish admin or instructor in this parish.",
    });
  });
});
