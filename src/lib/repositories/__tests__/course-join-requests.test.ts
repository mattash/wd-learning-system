import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  recordAdminAuditLog: vi.fn(),
}));

import { recordAdminAuditLog } from "@/lib/audit-log";
import {
  approveJoinRequest,
  createJoinRequest,
  getParishJoinRequests,
  getStudentPendingRequests,
  rejectJoinRequest,
} from "@/lib/repositories/course-join-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const request = {
  parish_id: "11111111-1111-4111-8111-111111111111",
  clerk_user_id: "user-1",
  course_id: "22222222-2222-4222-8222-222222222222",
};

function mockApproveSupabase({
  requestData = request,
  requestError = null,
  updatedData = { id: "request-1" },
  updateError = null,
  courseData = { id: request.course_id, scope: "PARISH" },
  courseError = null,
  rpcResult = { data: { ok: true, enrollment: { id: "enrollment-1" } }, error: null },
  upsertResult = { error: null },
}: {
  requestData?: typeof request | null;
  requestError?: Error | null;
  updatedData?: { id: string } | null;
  updateError?: Error | null;
  courseData?: { id: string; scope: string } | null;
  courseError?: Error | null;
  rpcResult?: { data: unknown; error: Error | null };
  upsertResult?: { error: Error | null };
} = {}) {
  const requestMaybeSingle = vi.fn(async () => ({ data: requestData, error: requestError }));
  const requestStatusEq = vi.fn(() => ({ maybeSingle: requestMaybeSingle }));
  const requestIdEq = vi.fn(() => ({ eq: requestStatusEq }));
  const requestSelect = vi.fn(() => ({ eq: requestIdEq }));

  const updateMaybeSingle = vi.fn(async () => ({ data: updatedData, error: updateError }));
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateStatusEq = vi.fn(() => ({ select: updateSelect }));
  const updateIdEq = vi.fn(() => ({ eq: updateStatusEq }));
  const update = vi.fn(() => ({ eq: updateIdEq }));

  const courseMaybeSingle = vi.fn(async () => ({ data: courseData, error: courseError }));
  const courseEq = vi.fn(() => ({ maybeSingle: courseMaybeSingle }));
  const courseSelect = vi.fn(() => ({ eq: courseEq }));

  const directEnrollmentUpsert = vi.fn(async () => upsertResult);
  const rpc = vi.fn(async () => rpcResult);

  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "course_join_requests") {
        return { select: requestSelect, update };
      }
      if (table === "courses") {
        return { select: courseSelect };
      }
      if (table === "enrollments") {
        return { upsert: directEnrollmentUpsert };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc,
  } as never);

  return { directEnrollmentUpsert, rpc, update };
}

describe("approveJoinRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates parish-scoped enrollments through the atomic adoption RPC", async () => {
    const { directEnrollmentUpsert, rpc } = mockApproveSupabase();

    await approveJoinRequest({ requestId: "request-1", actorClerkUserId: "admin-1" });

    expect(rpc).toHaveBeenCalledWith("create_parish_course_enrollment", {
      p_parish_id: request.parish_id,
      p_course_id: request.course_id,
      p_clerk_user_id: request.clerk_user_id,
    });
    expect(directEnrollmentUpsert).not.toHaveBeenCalled();
    expect(recordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "parish.join_request_approved",
        resourceId: "request-1",
      }),
    );
  });

  it("keeps direct upserts for non-parish course approvals", async () => {
    const { directEnrollmentUpsert, rpc } = mockApproveSupabase({
      courseData: { id: request.course_id, scope: "DIOCESE" },
    });

    await approveJoinRequest({ requestId: "request-1", actorClerkUserId: "admin-1" });

    expect(rpc).not.toHaveBeenCalled();
    expect(directEnrollmentUpsert).toHaveBeenCalledWith(
      {
        parish_id: request.parish_id,
        clerk_user_id: request.clerk_user_id,
        course_id: request.course_id,
      },
      { onConflict: "parish_id,clerk_user_id,course_id" },
    );
  });

  it("rolls approval back when parish enrollment RPC returns a domain error", async () => {
    const { update } = mockApproveSupabase({
      rpcResult: { data: { error: "Course is not adopted by this parish." }, error: null },
    });

    await expect(approveJoinRequest({ requestId: "request-1", actorClerkUserId: "admin-1" })).rejects.toThrow(
      "Course is not adopted by this parish.",
    );

    expect(update).toHaveBeenCalledWith({ status: "APPROVED" });
    expect(update).toHaveBeenCalledWith({ status: "PENDING" });
    expect(recordAdminAuditLog).not.toHaveBeenCalled();
  });

  it("rolls approval back when the course cannot be loaded", async () => {
    const courseError = new Error("course lookup failed");
    const { update } = mockApproveSupabase({ courseError });

    await expect(approveJoinRequest({ requestId: "request-1", actorClerkUserId: "admin-1" })).rejects.toThrow(
      "course lookup failed",
    );

    expect(update).toHaveBeenCalledWith({ status: "PENDING" });
    expect(recordAdminAuditLog).not.toHaveBeenCalled();
  });

  it("does not approve missing or non-pending requests", async () => {
    const { update, rpc, directEnrollmentUpsert } = mockApproveSupabase({ requestData: null });

    await expect(approveJoinRequest({ requestId: "request-1", actorClerkUserId: "admin-1" })).rejects.toThrow(
      "Request not found or not pending",
    );

    expect(update).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(directEnrollmentUpsert).not.toHaveBeenCalled();
  });
});

describe("course join request repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a join request when no enrollment or pending request exists", async () => {
    const enrollmentMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const enrollmentCourseEq = vi.fn(() => ({ maybeSingle: enrollmentMaybeSingle }));
    const enrollmentUserEq = vi.fn(() => ({ eq: enrollmentCourseEq }));
    const enrollmentParishEq = vi.fn(() => ({ eq: enrollmentUserEq }));
    const enrollmentSelect = vi.fn(() => ({ eq: enrollmentParishEq }));

    const pendingMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const pendingStatusEq = vi.fn(() => ({ maybeSingle: pendingMaybeSingle }));
    const pendingCourseEq = vi.fn(() => ({ eq: pendingStatusEq }));
    const pendingUserEq = vi.fn(() => ({ eq: pendingCourseEq }));
    const pendingParishEq = vi.fn(() => ({ eq: pendingUserEq }));
    const pendingSelect = vi.fn(() => ({ eq: pendingParishEq }));

    const created = {
      id: "request-1",
      parish_id: request.parish_id,
      clerk_user_id: request.clerk_user_id,
      course_id: request.course_id,
      status: "PENDING",
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
    };
    const single = vi.fn(async () => ({ data: created, error: null }));
    const insertSelect = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select: insertSelect }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "enrollments") {
          return { select: enrollmentSelect };
        }
        if (table === "course_join_requests") {
          return { select: pendingSelect, insert };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    await expect(createJoinRequest({
      parishId: request.parish_id,
      clerkUserId: request.clerk_user_id,
      courseId: request.course_id,
    })).resolves.toEqual({
      id: "request-1",
      parishId: request.parish_id,
      clerkUserId: request.clerk_user_id,
      courseId: request.course_id,
      status: "PENDING",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-02",
    });
  });

  it("rejects duplicate join requests for already-enrolled learners", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: "enrollment-1" }, error: null }));
    const eqCourse = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqCourse }));
    const eqParish = vi.fn(() => ({ eq: eqUser }));
    const select = vi.fn(() => ({ eq: eqParish }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(createJoinRequest({
      parishId: request.parish_id,
      clerkUserId: request.clerk_user_id,
      courseId: request.course_id,
    })).rejects.toThrow("Already enrolled in this course");
  });

  it("lists parish join requests with course titles", async () => {
    const data = [
      {
        id: "request-1",
        parish_id: request.parish_id,
        clerk_user_id: request.clerk_user_id,
        course_id: request.course_id,
        status: "PENDING",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
        courses: { title: "Intro Course" },
      },
    ];
    const statusEq = vi.fn(() => ({ data, error: null }));
    const order = vi.fn(() => ({ eq: statusEq }));
    const parishEq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq: parishEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(getParishJoinRequests(request.parish_id, "PENDING")).resolves.toEqual([
      expect.objectContaining({ id: "request-1", courseTitle: "Intro Course", status: "PENDING" }),
    ]);
    expect(statusEq).toHaveBeenCalledWith("status", "PENDING");
  });

  it("lists a student's pending join requests", async () => {
    const data = [
      {
        id: "request-1",
        parish_id: request.parish_id,
        clerk_user_id: request.clerk_user_id,
        course_id: request.course_id,
        status: "PENDING",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
    ];
    const order = vi.fn(() => ({ data, error: null }));
    const statusEq = vi.fn(() => ({ order }));
    const userEq = vi.fn(() => ({ eq: statusEq }));
    const parishEq = vi.fn(() => ({ eq: userEq }));
    const select = vi.fn(() => ({ eq: parishEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(getStudentPendingRequests({
      parishId: request.parish_id,
      clerkUserId: request.clerk_user_id,
    })).resolves.toEqual([
      expect.objectContaining({ id: "request-1", parishId: request.parish_id, status: "PENDING" }),
    ]);
  });

  it("rejects a pending join request and records an audit log", async () => {
    const requestMaybeSingle = vi.fn(async () => ({ data: request, error: null }));
    const requestStatusEq = vi.fn(() => ({ maybeSingle: requestMaybeSingle }));
    const requestIdEq = vi.fn(() => ({ eq: requestStatusEq }));
    const requestSelect = vi.fn(() => ({ eq: requestIdEq }));

    const updateMaybeSingle = vi.fn(async () => ({ data: { id: "request-1" }, error: null }));
    const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
    const updateStatusEq = vi.fn(() => ({ select: updateSelect }));
    const updateIdEq = vi.fn(() => ({ eq: updateStatusEq }));
    const update = vi.fn(() => ({ eq: updateIdEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select: requestSelect, update })),
    } as never);

    await rejectJoinRequest({ requestId: "request-1", actorClerkUserId: "admin-1" });

    expect(update).toHaveBeenCalledWith({ status: "REJECTED" });
    expect(recordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "parish.join_request_rejected",
        resourceId: "request-1",
      }),
    );
  });
});
