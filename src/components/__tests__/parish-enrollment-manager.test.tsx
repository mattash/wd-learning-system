import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParishEnrollmentManager } from "@/components/parish-enrollment-manager";
import type {
  ParishAdminCourseRow,
  ParishAdminEnrollmentRow,
  ParishAdminMemberRow,
} from "@/lib/repositories/parish-admin";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const members: ParishAdminMemberRow[] = [
  {
    clerk_user_id: "user_123",
    role: "student",
    email: "learner@example.com",
    display_name: "Learner One",
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

const enrollments: ParishAdminEnrollmentRow[] = [
  {
    id: "enrollment-1",
    clerk_user_id: "user_123",
    course_id: "course-1",
    cohort_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

function renderManager() {
  render(<ParishEnrollmentManager courses={courses} enrollments={enrollments} members={members} />);
}

describe("ParishEnrollmentManager", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a fallback save failure when an error response has invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );

    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Add enrollment" }));

    expect(await screen.findByText("Failed to save enrollment.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback save failure when the enrollment request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Add enrollment" }));

    expect(await screen.findByText("Failed to save enrollment.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback remove failure when an error response has invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );

    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Failed to remove enrollment.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback remove failure when the enrollment request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Failed to remove enrollment.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
