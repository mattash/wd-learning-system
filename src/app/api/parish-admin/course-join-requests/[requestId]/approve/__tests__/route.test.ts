import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/repositories/course-join-requests", () => ({ approveJoinRequest: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/parish-communications/notifications", () => ({
  notifyJoinRequestApproved: vi.fn(),
}));

import { POST } from "@/app/api/parish-admin/course-join-requests/[requestId]/approve/route";
import { requireParishRole } from "@/lib/authz";
import { notifyJoinRequestApproved } from "@/lib/parish-communications/notifications";
import { approveJoinRequest } from "@/lib/repositories/course-join-requests";
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

describe("POST /api/parish-admin/course-join-requests/[requestId]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "parish-1",
      role: "parish_admin",
    });
    vi.mocked(approveJoinRequest).mockResolvedValue();
    vi.mocked(notifyJoinRequestApproved).mockResolvedValue();
  });

  it("scopes the prefetch and approval to the authenticated parish", async () => {
    const { parishEq } = mockRequestPrefetch();

    const response = await POST(
      new Request(`http://localhost/api/parish-admin/course-join-requests/${requestId}/approve`, {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId }) },
    );

    expect(response.status).toBe(200);
    expect(parishEq).toHaveBeenCalledWith("parish_id", "parish-1");
    expect(approveJoinRequest).toHaveBeenCalledWith({
      requestId,
      parishId: "parish-1",
      actorClerkUserId: "admin-1",
    });
  });

  it("returns 400 for an invalid request ID without approving", async () => {
    const response = await POST(
      new Request("http://localhost/api/parish-admin/course-join-requests/not-a-uuid/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    expect(approveJoinRequest).not.toHaveBeenCalled();
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("keeps the generic repository failure and suppresses notification", async () => {
    mockRequestPrefetch();
    vi.mocked(approveJoinRequest).mockRejectedValue(
      new Error("Request not found or not pending"),
    );

    const response = await POST(
      new Request(`http://localhost/api/parish-admin/course-join-requests/${requestId}/approve`, {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request not found or not pending",
    });
    expect(notifyJoinRequestApproved).not.toHaveBeenCalled();
  });
});
