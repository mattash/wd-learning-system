import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/parish-communications/delivery-jobs", () => ({ enqueueParishMessageDeliveryJob: vi.fn() }));

import { GET, POST } from "@/app/api/parish-admin/communications/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { enqueueParishMessageDeliveryJob } from "@/lib/parish-communications/delivery-jobs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PARISH_ID = "11111111-1111-4111-8111-111111111111";
const COURSE_ID = "22222222-2222-4222-8222-222222222222";

describe("/api/parish-admin/communications branch coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE;
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: PARISH_ID,
      role: "parish_admin",
    });
  });

  it("returns 400 when listing sends fails", async () => {
    const limit = vi.fn(async () => ({ data: null, error: { message: "read failed" } }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "read failed" });
  });

  it("returns 400 when course/cohort audience is missing audienceValue", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "course",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "audienceValue is required for cohort/course audiences.",
    });
  });

  it("returns 400 when stalled learner recipient query fails", async () => {
    const stalledLt = vi.fn(async () => ({ data: null, error: { message: "video progress failed" } }));
    const stalledEqCompleted = vi.fn(() => ({ lt: stalledLt }));
    const stalledEqParish = vi.fn(() => ({ eq: stalledEqCompleted }));
    const stalledSelect = vi.fn(() => ({ eq: stalledEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "video_progress") return { select: stalledSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "stalled_learners",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "video progress failed" });
  });

  it("returns 400 when creating the send record fails", async () => {
    const membershipEq = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }],
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    const sendSingle = vi.fn(async () => ({ data: null, error: { message: "send insert failed" } }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "parish_message_sends") return { insert: sendInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "send insert failed" });
  });

  it("returns 400 when recipient records fail to insert", async () => {
    const membershipEq = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }],
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    const sendSingle = vi.fn(async () => ({ data: { id: "send-1", recipient_count: 1 }, error: null }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));

    const recipientInsert = vi.fn(async () => ({ error: { message: "recipient insert failed" } }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "parish_message_sends") return { insert: sendInsert };
        if (table === "parish_message_recipients") return { insert: recipientInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "recipient insert failed" });
  });

  it("returns 500 and marks send as failed when queueing fails", async () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "mock";
    vi.mocked(enqueueParishMessageDeliveryJob).mockRejectedValue(new Error("queue failed"));

    const membershipEq = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }],
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    const sendSingle = vi.fn(async () => ({ data: { id: "send-1", recipient_count: 1 }, error: null }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));
    const sendUpdateEq = vi.fn(async () => ({ error: null }));
    const sendUpdate = vi.fn(() => ({ eq: sendUpdateEq }));

    const recipientInsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "parish_message_sends") return { insert: sendInsert, update: sendUpdate };
        if (table === "parish_message_recipients") return { insert: recipientInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "queue failed" });
    expect(sendUpdate).toHaveBeenCalledWith({ delivery_status: "failed" });
    expect(sendUpdateEq).toHaveBeenCalledWith("id", "send-1");
    expect(recordAdminAuditLog).not.toHaveBeenCalled();
  });

  it("returns 400 when a cohort is outside the parish", async () => {
    const cohortMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const cohortEqId = vi.fn(() => ({ maybeSingle: cohortMaybeSingle }));
    const cohortEqParish = vi.fn(() => ({ eq: cohortEqId }));
    const cohortSelect = vi.fn(() => ({ eq: cohortEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "cohort",
          audienceValue: COURSE_ID,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Cohort does not belong to this parish." });
  });

  it("returns 400 when cohort ownership lookup fails", async () => {
    const cohortMaybeSingle = vi.fn(async () => ({ data: null, error: { message: "cohort lookup failed" } }));
    const cohortEqId = vi.fn(() => ({ maybeSingle: cohortMaybeSingle }));
    const cohortEqParish = vi.fn(() => ({ eq: cohortEqId }));
    const cohortSelect = vi.fn(() => ({ eq: cohortEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "cohort",
          audienceValue: COURSE_ID,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cohort lookup failed" });
  });

  it("returns 400 when cohort enrollment resolution fails", async () => {
    const cohortMaybeSingle = vi.fn(async () => ({ data: { id: COURSE_ID }, error: null }));
    const cohortEqId = vi.fn(() => ({ maybeSingle: cohortMaybeSingle }));
    const cohortEqParish = vi.fn(() => ({ eq: cohortEqId }));
    const cohortSelect = vi.fn(() => ({ eq: cohortEqParish }));

    const enrollmentsEqCohort = vi.fn(async () => ({ data: null, error: { message: "cohort enrollments failed" } }));
    const enrollmentsEqParish = vi.fn(() => ({ eq: enrollmentsEqCohort }));
    const enrollmentsSelect = vi.fn(() => ({ eq: enrollmentsEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortSelect };
        if (table === "enrollments") return { select: enrollmentsSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "cohort",
          audienceValue: COURSE_ID,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cohort enrollments failed" });
  });

  it("supports course audiences and logs successfully", async () => {
    const enrollmentsEqCourse = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }, { clerk_user_id: "user-1" }, { clerk_user_id: "user-2" }],
      error: null,
    }));
    const enrollmentsEqParish = vi.fn(() => ({ eq: enrollmentsEqCourse }));
    const enrollmentsSelect = vi.fn(() => ({ eq: enrollmentsEqParish }));

    const sendSingle = vi.fn(async () => ({ data: { id: "send-course", recipient_count: 2 }, error: null }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));

    const recipientInsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "enrollments") return { select: enrollmentsSelect };
        if (table === "parish_message_sends") return { insert: sendInsert };
        if (table === "parish_message_recipients") return { insert: recipientInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "course",
          audienceValue: COURSE_ID,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
    const json = await response.json();
    expect(json.send.id).toBe("send-course");
  });

  it("returns 400 when course enrollment resolution fails", async () => {
    const enrollmentsEqCourse = vi.fn(async () => ({ data: null, error: { message: "course enrollments failed" } }));
    const enrollmentsEqParish = vi.fn(() => ({ eq: enrollmentsEqCourse }));
    const enrollmentsSelect = vi.fn(() => ({ eq: enrollmentsEqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "enrollments") return { select: enrollmentsSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "course",
          audienceValue: COURSE_ID,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "course enrollments failed" });
  });

  it("supports cohort audiences and deduplicates recipients", async () => {
    const cohortMaybeSingle = vi.fn(async () => ({ data: { id: COURSE_ID }, error: null }));
    const cohortEqId = vi.fn(() => ({ maybeSingle: cohortMaybeSingle }));
    const cohortEqParish = vi.fn(() => ({ eq: cohortEqId }));
    const cohortSelect = vi.fn(() => ({ eq: cohortEqParish }));

    const enrollmentsEqCohort = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }, { clerk_user_id: "user-1" }, { clerk_user_id: "user-2" }],
      error: null,
    }));
    const enrollmentsEqParish = vi.fn(() => ({ eq: enrollmentsEqCohort }));
    const enrollmentsSelect = vi.fn(() => ({ eq: enrollmentsEqParish }));

    const sendSingle = vi.fn(async () => ({ data: { id: "send-cohort", recipient_count: 2 }, error: null }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));

    const recipientInsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cohorts") return { select: cohortSelect };
        if (table === "enrollments") return { select: enrollmentsSelect };
        if (table === "parish_message_sends") return { insert: sendInsert };
        if (table === "parish_message_recipients") return { insert: recipientInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Body",
          audienceType: "cohort",
          audienceValue: COURSE_ID,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.send.id).toBe("send-cohort");
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });
});
