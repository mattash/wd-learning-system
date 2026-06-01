import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminEnrollmentManager } from "@/components/admin-enrollment-manager";
import type { DioceseCourseRow, DioceseEnrollmentRow, DioceseParishRow } from "@/lib/repositories/diocese-admin";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const parishes: DioceseParishRow[] = [
  {
    id: "parish-1",
    name: "St. Mary",
    slug: "st-mary",
    allow_self_signup: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

const courses: DioceseCourseRow[] = [
  {
    id: "course-1",
    title: "Foundations",
    description: null,
    thumbnail_url: null,
    instructor: null,
    duration_hours: null,
    category: null,
    scope: "DIOCESE",
    published: true,
    publicly_browseable: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const enrollments: DioceseEnrollmentRow[] = [
  {
    id: "enrollment-1",
    parish_id: "parish-1",
    clerk_user_id: "user_123",
    course_id: "course-1",
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

function renderManager() {
  render(<AdminEnrollmentManager courses={courses} enrollments={enrollments} parishes={parishes} />);
}

describe("AdminEnrollmentManager", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "+ Add enrollment" }));
    fireEvent.change(screen.getByPlaceholderText("clerk_user_id"), { target: { value: "user_456" } });
    fireEvent.click(screen.getByRole("button", { name: "Enroll" }));

    expect(await screen.findByText("Failed to save enrollment.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback save failure when the enrollment request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "+ Add enrollment" }));
    fireEvent.change(screen.getByPlaceholderText("clerk_user_id"), { target: { value: "user_456" } });
    fireEvent.click(screen.getByRole("button", { name: "Enroll" }));

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
