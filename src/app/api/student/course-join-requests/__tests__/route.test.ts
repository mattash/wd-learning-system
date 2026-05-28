import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/course-join-requests", () => ({
  createJoinRequest: vi.fn(),
  getStudentPendingRequests: vi.fn(),
}));

import { POST } from "@/app/api/student/course-join-requests/route";
import { requireParishRole } from "@/lib/authz";
import { createJoinRequest } from "@/lib/repositories/course-join-requests";

describe("POST /api/student/course-join-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "student-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "student",
    });
  });

  it("returns 400 for invalid course ids", async () => {
    const response = await POST(
      new Request("http://localhost/api/student/course-join-requests", {
        method: "POST",
        body: JSON.stringify({ courseId: "not-a-uuid" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: expect.any(String) });
    expect(createJoinRequest).not.toHaveBeenCalled();
  });
});
