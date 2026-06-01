import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/catalog", () => ({
  getCatalogCourses: vi.fn(),
}));

vi.mock("@/lib/repositories/course-join-requests", () => ({
  getStudentPendingRequests: vi.fn(),
}));

vi.mock("@/components/course-join/request-join-button", () => ({
  RequestJoinButton: ({ courseId }: { courseId: string }) => <button>Request {courseId}</button>,
}));

import CatalogPage from "@/app/app/catalog/page";
import { requireParishRole } from "@/lib/authz";
import { getCatalogCourses } from "@/lib/repositories/catalog";
import { getStudentPendingRequests } from "@/lib/repositories/course-join-requests";

describe("CatalogPage enrollment confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      parishId: "parish-1",
      clerkUserId: "user-1",
      role: "student",
    });
    vi.mocked(getCatalogCourses).mockResolvedValue([]);
    vi.mocked(getStudentPendingRequests).mockResolvedValue([]);
  });

  it("shows a confirmation after onboarding submits a course request", async () => {
    render(await CatalogPage({ searchParams: Promise.resolve({ enrollment: "requested" }) }));

    expect(
      screen.getByText("Your enrollment request has been submitted. A parish admin will review it shortly."),
    ).toBeInTheDocument();
  });

  it("renders enrolled, pending, and requestable catalog courses", async () => {
    vi.mocked(getCatalogCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Enrolled Course",
        description: "Already started",
        thumbnailUrl: "/course.png",
        scope: "DIOCESE",
        lessonCount: 1,
        enrolled: true,
      },
      {
        id: "course-2",
        title: "Pending Course",
        description: null,
        thumbnailUrl: null,
        scope: "PARISH",
        lessonCount: 2,
        enrolled: false,
      },
      {
        id: "course-3",
        title: "Available Course",
        description: "Open to request",
        thumbnailUrl: null,
        scope: "DIOCESE",
        lessonCount: 0,
        enrolled: false,
      },
    ]);
    vi.mocked(getStudentPendingRequests).mockResolvedValue([
      {
        id: "request-1",
        parishId: "parish-1",
        clerkUserId: "user-1",
        courseId: "course-2",
        status: "PENDING",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);

    render(await CatalogPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/app/courses/course-1");
    expect(document.getElementById("course-course-2")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Pending Course" }).some(
        (link) => link.getAttribute("href") === "#course-course-2",
      ),
    ).toBe(true);
    expect(screen.getByText("Request sent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request course-3" })).toBeInTheDocument();
  });

  it("shows a search empty state when no visible course matches", async () => {
    vi.mocked(getCatalogCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Foundations",
        description: null,
        thumbnailUrl: null,
        scope: "DIOCESE",
        lessonCount: 1,
        enrolled: false,
      },
    ]);

    render(await CatalogPage({ searchParams: Promise.resolve({ q: "history" }) }));

    expect(screen.getByText("No courses match your search.")).toBeInTheDocument();
  });

  it("shows a category empty state when only the category filter removes courses", async () => {
    vi.mocked(getCatalogCourses).mockResolvedValue([
      {
        id: "course-1",
        title: "Foundations",
        description: null,
        thumbnailUrl: null,
        scope: "DIOCESE",
        lessonCount: 1,
        enrolled: false,
      },
    ]);

    render(await CatalogPage({ searchParams: Promise.resolve({ category: "Scripture" }) }));

    expect(screen.getByText("No courses match this category.")).toBeInTheDocument();
  });
});
