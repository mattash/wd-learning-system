import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, GET, POST } from "@/app/api/parish-admin/enrollments/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("lists enrollments for the active parish", async () => {
    const limit = vi.fn(async () => ({ data: [{ id: "e1" }], error: null }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET(new Request("http://localhost/api/parish-admin/enrollments"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enrollments: [{ id: "e1" }] });
  });

  it("limits enrollment list to instructor-assigned cohorts", async () => {
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "instructor-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "instructor",
    });

    const cohortsEqFacilitator = vi.fn(async () => ({ data: [{ id: "cohort-1" }], error: null }));
    const cohortsEqParish = vi.fn(() => ({ eq: cohortsEqFacilitator }));
    const cohortsSelect = vi.fn(() => ({ eq: cohortsEqParish }));

    const inCohort = vi.fn(async () => ({ data: [{ id: "e2" }], error: null }));
    const limit = vi.fn(() => ({ in: inCohort }));
    const order = vi.fn(() => ({ limit }));
    const eqParish = vi.fn(() => ({ order }));
    const enrollmentsSelect = vi.fn(() => ({ eq: eqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortsSelect };
        if (table === "enrollments") return { select: enrollmentsSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await GET(new Request("http://localhost/api/parish-admin/enrollments"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enrollments: [{ id: "e2" }] });
    expect(cohortsEqFacilitator).toHaveBeenCalledWith("facilitator_clerk_user_id", "instructor-1");
    expect(inCohort).toHaveBeenCalledWith("cohort_id", ["cohort-1"]);
  });

  it("creates an enrollment for a parish member", async () => {
    const memberMaybeSingle = vi.fn(async () => ({ data: { clerk_user_id: "user-1" }, error: null }));
    const memberEqUser = vi.fn(() => ({ maybeSingle: memberMaybeSingle }));
    const memberEqParish = vi.fn(() => ({ eq: memberEqUser }));
    const memberSelect = vi.fn(() => ({ eq: memberEqParish }));

    const courseMaybeSingle = vi.fn(async () => ({ data: { id: "c1", scope: "DIOCESE", published: true }, error: null }));
    const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
    const courseSelect = vi.fn(() => ({ eq: courseEq }));

    const enrollmentSingle = vi.fn(async () => ({ data: { id: "e1" }, error: null }));
    const enrollmentSelect = vi.fn(() => ({ single: enrollmentSingle }));
    const enrollmentUpsert = vi.fn(() => ({ select: enrollmentSelect }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: memberSelect };
        if (table === "courses") return { select: courseSelect };
        if (table === "enrollments") return { upsert: enrollmentUpsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-1",
          courseId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ enrollment: { id: "e1" } });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when learner is not in active parish", async () => {
    const memberMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const memberEqUser = vi.fn(() => ({ maybeSingle: memberMaybeSingle }));
    const memberEqParish = vi.fn(() => ({ eq: memberEqUser }));
    const memberSelect = vi.fn(() => ({ eq: memberEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: memberSelect };
        if (table === "courses") return { select: vi.fn() };
        if (table === "enrollments") return { upsert: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/enrollments", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-1",
          courseId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Learner must belong to this parish before enrollment.",
    });
  });

  it("removes an enrollment", async () => {
    const eqCourse = vi.fn(async () => ({ error: null }));
    const eqUser = vi.fn(() => ({ eq: eqCourse }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const del = vi.fn(() => ({ eq: eqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ delete: del })),
    } as never);

    const response = await DELETE(
      new Request("http://localhost/api/parish-admin/enrollments", {
        method: "DELETE",
        body: JSON.stringify({
          clerkUserId: "user-1",
          courseId: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });
});
