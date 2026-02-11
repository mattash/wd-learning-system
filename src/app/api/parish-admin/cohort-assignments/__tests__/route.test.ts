import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { PATCH } from "@/app/api/parish-admin/cohort-assignments/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/cohort-assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("assigns an enrollment to a cohort", async () => {
    const cohortMaybeSingle = vi.fn(async () => ({ data: { id: "cohort-1" }, error: null }));
    const cohortEqParish = vi.fn(() => ({ maybeSingle: cohortMaybeSingle }));
    const cohortEqId = vi.fn(() => ({ eq: cohortEqParish }));
    const cohortSelect = vi.fn(() => ({ eq: cohortEqId }));

    const enrollmentSingle = vi.fn(async () => ({ data: { id: "enroll-1", cohort_id: "cohort-1" }, error: null }));
    const enrollmentSelect = vi.fn(() => ({ single: enrollmentSingle }));
    const enrollmentEqParish = vi.fn(() => ({ select: enrollmentSelect }));
    const enrollmentEqId = vi.fn(() => ({ eq: enrollmentEqParish }));
    const enrollmentUpdate = vi.fn(() => ({ eq: enrollmentEqId }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortSelect };
        if (table === "enrollments") return { update: enrollmentUpdate };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/parish-admin/cohort-assignments", {
        method: "PATCH",
        body: JSON.stringify({
          enrollmentId: "22222222-2222-4222-8222-222222222222",
          cohortId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enrollment: { id: "enroll-1", cohort_id: "cohort-1" },
    });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("clears cohort assignment", async () => {
    const enrollmentSingle = vi.fn(async () => ({ data: { id: "enroll-1", cohort_id: null }, error: null }));
    const enrollmentSelect = vi.fn(() => ({ single: enrollmentSingle }));
    const enrollmentEqParish = vi.fn(() => ({ select: enrollmentSelect }));
    const enrollmentEqId = vi.fn(() => ({ eq: enrollmentEqParish }));
    const enrollmentUpdate = vi.fn(() => ({ eq: enrollmentEqId }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: vi.fn() };
        if (table === "enrollments") return { update: enrollmentUpdate };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/parish-admin/cohort-assignments", {
        method: "PATCH",
        body: JSON.stringify({
          enrollmentId: "22222222-2222-4222-8222-222222222222",
          cohortId: null,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enrollment: { id: "enroll-1", cohort_id: null },
    });
  });
});
