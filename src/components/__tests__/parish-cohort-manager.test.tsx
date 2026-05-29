import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParishCohortManager } from "@/components/parish-cohort-manager";
import type {
  ParishAdminCohortRow,
  ParishAdminCourseRow,
  ParishAdminEnrollmentRow,
  ParishAdminMemberRow,
} from "@/lib/repositories/parish-admin";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const members: ParishAdminMemberRow[] = [
  {
    clerk_user_id: "user_facilitator",
    role: "parish_admin",
    email: "facilitator@example.com",
    display_name: "Facilitator One",
  },
];

const cohorts: ParishAdminCohortRow[] = [
  {
    id: "cohort-1",
    name: "Foundations Cohort",
    facilitator_clerk_user_id: "user_facilitator",
    cadence: "weekly",
    next_session_at: "2026-02-03T17:30:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const enrollments: ParishAdminEnrollmentRow[] = [
  {
    id: "enrollment-1",
    clerk_user_id: "user_student",
    course_id: "course-1",
    cohort_id: "cohort-1",
    created_at: "2026-01-02T00:00:00.000Z",
  },
];

const courses: ParishAdminCourseRow[] = [
  {
    id: "course-1",
    title: "Foundations",
    description: null,
    published: true,
    scope: "DIOCESE",
  },
];

function renderManager(canManageAll: boolean) {
  return render(
    <ParishCohortManager
      canManageAll={canManageAll}
      cohorts={cohorts}
      courses={courses}
      enrollments={enrollments}
      members={members}
    />,
  );
}

describe("ParishCohortManager", () => {
  it("renders existing cohorts read-only for non-admin users", () => {
    const { container } = renderManager(false);

    expect(screen.getByText("Foundations Cohort")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("renders cohort mutation controls for users who can manage all", () => {
    const { container } = renderManager(true);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(container.querySelector("input")).not.toBeNull();
    expect(container.querySelector("select")).not.toBeNull();
  });
});
