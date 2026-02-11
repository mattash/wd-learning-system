import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/repositories/parish-admin", () => ({ getParishAdminDashboardDataForUser: vi.fn() }));

import { GET } from "@/app/api/parish-admin/participation/export/route";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

describe("GET /api/parish-admin/participation/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("returns CSV export", async () => {
    vi.mocked(getParishAdminDashboardDataForUser).mockResolvedValue({
      role: "parish_admin",
      overview: {
        memberCount: 1,
        enrollmentCount: 1,
        activeLearnerCount: 1,
        stalledLearnerCount: 0,
        completionRate: 50,
      },
      visibleCourses: [
        { id: "22222222-2222-4222-8222-222222222222", title: "RCIA", description: null, published: true, scope: "PARISH" },
      ],
      dioceseCourses: [],
      adoptedParishCourses: [],
      availableParishCourses: [],
      enrollments: [],
      members: [{ clerk_user_id: "user-1", role: "student", email: "person@example.com", display_name: "Person One" }],
      cohorts: [{ id: "33333333-3333-4333-8333-333333333333", name: "Cohort A", facilitator_clerk_user_id: null, cadence: "weekly", next_session_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
      communicationSends: [],
      participationRows: [
        {
          enrollment_id: "enroll-1",
          clerk_user_id: "user-1",
          course_id: "22222222-2222-4222-8222-222222222222",
          cohort_id: "33333333-3333-4333-8333-333333333333",
          enrolled_at: "2026-01-02T00:00:00.000Z",
          completed_lessons: 2,
          started_lessons: 2,
          total_lessons: 4,
          progress_percent: 50,
          last_activity_at: "2026-01-10T00:00:00.000Z",
          status: "active",
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/parish-admin/participation/export"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const body = await response.text();
    expect(body).toContain("learner_name,learner_email");
    expect(body).toContain("\"Person One\"");
    expect(body).toContain("\"RCIA\"");
  });

  it("applies cohort and status filters", async () => {
    vi.mocked(getParishAdminDashboardDataForUser).mockResolvedValue({
      role: "parish_admin",
      overview: {
        memberCount: 2,
        enrollmentCount: 2,
        activeLearnerCount: 1,
        stalledLearnerCount: 1,
        completionRate: 50,
      },
      visibleCourses: [
        { id: "22222222-2222-4222-8222-222222222222", title: "RCIA", description: null, published: true, scope: "PARISH" },
      ],
      dioceseCourses: [],
      adoptedParishCourses: [],
      availableParishCourses: [],
      enrollments: [],
      members: [
        { clerk_user_id: "user-1", role: "student", email: "a@example.com", display_name: "Alpha" },
        { clerk_user_id: "user-2", role: "student", email: "b@example.com", display_name: "Beta" },
      ],
      cohorts: [{ id: "33333333-3333-4333-8333-333333333333", name: "Cohort A", facilitator_clerk_user_id: null, cadence: "weekly", next_session_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
      communicationSends: [],
      participationRows: [
        {
          enrollment_id: "enroll-1",
          clerk_user_id: "user-1",
          course_id: "22222222-2222-4222-8222-222222222222",
          cohort_id: "33333333-3333-4333-8333-333333333333",
          enrolled_at: "2026-01-02T00:00:00.000Z",
          completed_lessons: 1,
          started_lessons: 1,
          total_lessons: 4,
          progress_percent: 25,
          last_activity_at: "2026-01-03T00:00:00.000Z",
          status: "stalled",
        },
        {
          enrollment_id: "enroll-2",
          clerk_user_id: "user-2",
          course_id: "22222222-2222-4222-8222-222222222222",
          cohort_id: null,
          enrolled_at: "2026-01-02T00:00:00.000Z",
          completed_lessons: 0,
          started_lessons: 0,
          total_lessons: 4,
          progress_percent: 0,
          last_activity_at: null,
          status: "not_started",
        },
      ],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/parish-admin/participation/export?cohortId=33333333-3333-4333-8333-333333333333&status=stalled",
      ),
    );
    const body = await response.text();
    expect(body).toContain("\"Alpha\"");
    expect(body).not.toContain("\"Beta\"");
  });

  it("returns 400 for invalid filters", async () => {
    const response = await GET(
      new Request("http://localhost/api/parish-admin/participation/export?status=invalid"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid participation export filters." });
  });
});
