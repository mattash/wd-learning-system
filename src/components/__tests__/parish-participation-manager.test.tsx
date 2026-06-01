import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ParishParticipationManager } from "@/components/parish-participation-manager";
import type {
  ParishAdminCohortRow,
  ParishAdminCourseRow,
  ParishAdminMemberRow,
  ParishAdminParticipationRow,
} from "@/lib/repositories/parish-admin";

const courses: ParishAdminCourseRow[] = [
  {
    id: "course-1",
    title: "Foundations",
    description: null,
    published: true,
    scope: "DIOCESE",
  },
];

const cohorts: ParishAdminCohortRow[] = [
  {
    id: "cohort-1",
    name: "Spring Cohort",
    facilitator_clerk_user_id: null,
    cadence: "weekly",
    next_session_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const members: ParishAdminMemberRow[] = [
  {
    clerk_user_id: "user_123",
    role: "student",
    email: "learner@example.com",
    display_name: "Learner One",
  },
];

const participationRows: ParishAdminParticipationRow[] = [
  {
    enrollment_id: "enrollment-1",
    clerk_user_id: "user_123",
    course_id: "course-1",
    cohort_id: "cohort-1",
    enrolled_at: "2026-03-05T23:30:00.000Z",
    completed_lessons: 1,
    started_lessons: 1,
    total_lessons: 4,
    progress_percent: 25,
    last_activity_at: "2026-02-01T01:30:00.000Z",
    status: "active",
  },
];

describe("ParishParticipationManager", () => {
  it("renders participation dates with a deterministic UTC format", () => {
    render(
      <ParishParticipationManager
        canLogCommunications={false}
        cohorts={cohorts}
        courses={courses}
        members={members}
        participationRows={participationRows}
      />,
    );

    expect(screen.getByText("2/1/2026")).toBeInTheDocument();
    expect(screen.getByText("3/5/2026")).toBeInTheDocument();
  });
});
