import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, PATCH } from "@/app/api/parish-admin/cohorts/[cohortId]/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/cohorts/[cohortId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("updates a cohort", async () => {
    const existingMaybeSingle = vi.fn(async () => ({
      data: { id: "cohort-1", facilitator_clerk_user_id: "facilitator-1" },
      error: null,
    }));
    const existingEqParish = vi.fn(() => ({ maybeSingle: existingMaybeSingle }));
    const existingEqId = vi.fn(() => ({ eq: existingEqParish }));
    const cohortSelect = vi.fn(() => ({ eq: existingEqId }));

    const membershipMaybeSingle = vi.fn(async () => ({ data: { role: "parish_admin" }, error: null }));
    const membershipEqUser = vi.fn(() => ({ maybeSingle: membershipMaybeSingle }));
    const membershipEqParish = vi.fn(() => ({ eq: membershipEqUser }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEqParish }));

    const updateSingle = vi.fn(async () => ({ data: { id: "cohort-1", name: "Updated" }, error: null }));
    const updateSelect = vi.fn(() => ({ single: updateSingle }));
    const updateEqParish = vi.fn(() => ({ select: updateSelect }));
    const updateEqId = vi.fn(() => ({ eq: updateEqParish }));
    const cohortUpdate = vi.fn(() => ({ eq: updateEqId }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "cohorts") return { select: cohortSelect, update: cohortUpdate };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/parish-admin/cohorts/11111111-1111-4111-8111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated",
          facilitatorClerkUserId: "facilitator-1",
          cadence: "biweekly",
          nextSessionAt: null,
        }),
      }),
      { params: Promise.resolve({ cohortId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cohort: { id: "cohort-1", name: "Updated" } });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when instructor tries to update unassigned cohort", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "instructor-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "instructor",
    });

    const existingMaybeSingle = vi.fn(async () => ({
      data: { id: "cohort-1", facilitator_clerk_user_id: "someone-else" },
      error: null,
    }));
    const existingEqParish = vi.fn(() => ({ maybeSingle: existingMaybeSingle }));
    const existingEqId = vi.fn(() => ({ eq: existingEqParish }));
    const cohortSelect = vi.fn(() => ({ eq: existingEqId }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortSelect, update: vi.fn() };
        if (table === "parish_memberships") return { select: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/parish-admin/cohorts/11111111-1111-4111-8111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({
          name: "Updated",
          facilitatorClerkUserId: "instructor-1",
          cadence: "weekly",
          nextSessionAt: null,
        }),
      }),
      { params: Promise.resolve({ cohortId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "You can only manage cohorts assigned to you." });
  });

  it("deletes a cohort", async () => {
    const cohortEqParish = vi.fn(async () => ({ error: null }));
    const cohortEqId = vi.fn(() => ({ eq: cohortEqParish }));
    const cohortDelete = vi.fn(() => ({ eq: cohortEqId }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ delete: cohortDelete })),
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/cohorts/11111111-1111-4111-8111-111111111111", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ cohortId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });
});
