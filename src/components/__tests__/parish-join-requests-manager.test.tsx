import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParishJoinRequestsManager } from "@/components/parish-join-requests-manager";
import type { CourseJoinRequestWithDetails } from "@/lib/repositories/course-join-requests";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseRequest: CourseJoinRequestWithDetails = {
  id: "request-1",
  parishId: "parish-1",
  clerkUserId: "user_clerk_123",
  courseId: "course-1",
  status: "PENDING",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  courseTitle: "Intro Course",
  studentName: "Ani Student",
  studentEmail: "ani@example.com",
};

describe("ParishJoinRequestsManager", () => {
  it("renders student name and email when available", () => {
    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    expect(screen.getByText("Ani Student")).toBeInTheDocument();
    expect(screen.getByText("ani@example.com")).toBeInTheDocument();
    expect(screen.getByText("Intro Course")).toBeInTheDocument();
  });

  it("falls back to clerk user id when student details are missing", () => {
    const requestWithoutDetails: CourseJoinRequestWithDetails = {
      ...baseRequest,
      studentName: undefined,
      studentEmail: undefined,
    };

    render(<ParishJoinRequestsManager initialRequests={[requestWithoutDetails]} />);

    const fallbackElements = screen.getAllByText("user_clerk_123");
    expect(fallbackElements.length).toBeGreaterThanOrEqual(2);
  });
});
