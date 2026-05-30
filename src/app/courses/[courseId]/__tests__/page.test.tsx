import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
  redirect: navigationMocks.redirect,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  hasCompletedOnboarding: vi.fn(),
  requireActiveParish: vi.fn(),
}));

vi.mock("@/lib/repositories/courses", () => ({
  getPublicCoursePreview: vi.fn(),
  isUserEnrolledInCourse: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

import PublicCoursePage from "@/app/courses/[courseId]/page";
import { hasCompletedOnboarding, requireActiveParish } from "@/lib/authz";
import { getPublicCoursePreview, isUserEnrolledInCourse } from "@/lib/repositories/courses";

const courseId = "11111111-1111-4111-8111-111111111111";

describe("PublicCoursePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(getPublicCoursePreview).mockResolvedValue({
      course: {
        id: courseId,
        title: "Foundations",
        description: "Learn the basics.",
        published: true,
        scope: "DIOCESE",
        thumbnailUrl: "/course.png",
      },
      modules: [
        {
          id: "module-1",
          title: "Getting Started",
          sort_order: 1,
          lessons: [{ id: "lesson-1", title: "Welcome", sort_order: 1 }],
        },
      ],
      lessonCount: 1,
    });
  });

  it("renders a public preview and register CTA for anonymous visitors", async () => {
    render(await PublicCoursePage({ params: Promise.resolve({ courseId }) }));

    expect(screen.getByRole("heading", { name: "Foundations" })).toBeInTheDocument();
    expect(screen.getByText("Learn the basics.")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register & Enroll" })).toHaveAttribute(
      "href",
      `/sign-up?enrollCourseId=${courseId}`,
    );
  });

  it("renders an empty-outline preview without a thumbnail", async () => {
    vi.mocked(getPublicCoursePreview).mockResolvedValue({
      course: {
        id: courseId,
        title: "Preview Only",
        description: null,
        published: true,
        scope: "PARISH",
        thumbnailUrl: null,
      },
      modules: [],
      lessonCount: 0,
    });

    render(await PublicCoursePage({ params: Promise.resolve({ courseId }) }));

    expect(screen.getByRole("heading", { name: "Preview Only" })).toBeInTheDocument();
    expect(screen.getByText("Parish course")).toBeInTheDocument();
    expect(screen.getByText("Course outline coming soon.")).toBeInTheDocument();
  });

  it("returns 404 when the course is not public", async () => {
    vi.mocked(getPublicCoursePreview).mockResolvedValue(null);

    await expect(PublicCoursePage({ params: Promise.resolve({ courseId }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigationMocks.notFound).toHaveBeenCalled();
  });

  it("redirects an authenticated enrolled user to the course", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-1" } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(hasCompletedOnboarding).mockResolvedValue(true);
    vi.mocked(requireActiveParish).mockResolvedValue("parish-1");
    vi.mocked(isUserEnrolledInCourse).mockResolvedValue(true);

    await expect(PublicCoursePage({ params: Promise.resolve({ courseId }) })).rejects.toThrow(
      `NEXT_REDIRECT:/app/courses/${courseId}`,
    );
  });

  it("redirects an authenticated unenrolled user to the catalog flow", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-1" } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(hasCompletedOnboarding).mockResolvedValue(true);
    vi.mocked(requireActiveParish).mockResolvedValue("parish-1");
    vi.mocked(isUserEnrolledInCourse).mockResolvedValue(false);

    await expect(PublicCoursePage({ params: Promise.resolve({ courseId }) })).rejects.toThrow(
      `NEXT_REDIRECT:/app/catalog?courseId=${courseId}`,
    );
  });

  it("preserves enrollment intent for authenticated users who still need onboarding", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-1" } as Awaited<ReturnType<typeof auth>>);
    vi.mocked(hasCompletedOnboarding).mockResolvedValue(false);

    await expect(PublicCoursePage({ params: Promise.resolve({ courseId }) })).rejects.toThrow(
      `NEXT_REDIRECT:/app/onboarding?enrollCourseId=${courseId}`,
    );
    expect(requireActiveParish).not.toHaveBeenCalled();
  });
});
