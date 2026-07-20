import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/repositories/course-join-requests", () => ({ rejectJoinRequest: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/parish-communications/notifications", () => ({
  notifyJoinRequestRejected: vi.fn(),
}));

import { POST } from "@/app/api/parish-admin/course-join-requests/[requestId]/reject/route";
import { requireParishRole } from "@/lib/authz";
import { notifyJoinRequestRejected } from "@/lib/parish-communications/notifications";
import { rejectJoinRequest } from "@/lib/repositories/course-join-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const requestId = "33333333-3333-4333-8333-333333333333";

function mockRequestPrefetch() {
  const single = vi.fn(async () => ({
    data: { clerk_user_id: "student-1", course_id: "course-1" },
    error: null,
  }));
  const statusEq = vi.fn(() => ({ single }));
  const parishEq = vi.fn(() => ({ eq: statusEq }));
  const idEq = vi.fn(() => ({ eq: parishEq }));
  const select = vi.fn(() => ({ eq: idEq }));

  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    from: vi.fn(() => ({ select })),
  } as never);

  return { parishEq };
}

describe("POST /api/parish-admin/course-join-requests/[requestId]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    vi.mocked(rejectJoinRequest).mockResolvedValue();
    vi.mocked(notifyJoinRequestRejected).mockResolvedValue();
  });

  it("scopes the prefetch and rejection to the authenticated parish", async () => {
    const { parishEq } = mockRequestPrefetch();

    const response = await POST(
      new Request(`http://localhost/api/parish-admin/course-join-requests/${requestId}/reject`, {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId }) },
    );

    expect(response.status).toBe(200);
    expect(parishEq).toHaveBeenCalledWith("parish_id", "parish-1");
    expect(rejectJoinRequest).toHaveBeenCalledWith({
      requestId,
      parishId: "parish-1",
      actorClerkUserId: "admin-1",
    });
  });

  it("returns 400 for an invalid request ID without rejecting", async () => {
    const response = await POST(
      new Request("http://localhost/api/parish-admin/course-join-requests/not-a-uuid/reject", {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    expect(rejectJoinRequest).not.toHaveBeenCalled();
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("keeps the generic repository failure and suppresses notification", async () => {
    mockRequestPrefetch();
    vi.mocked(rejectJoinRequest).mockRejectedValue(
      new Error("Request not found or not pending"),
    );

    const response = await POST(
      new Request(`http://localhost/api/parish-admin/course-join-requests/${requestId}/reject`, {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request not found or not pending",
    });
    expect(notifyJoinRequestRejected).not.toHaveBeenCalled();
  });
});
