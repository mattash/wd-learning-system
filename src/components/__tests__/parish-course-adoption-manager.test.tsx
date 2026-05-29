import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParishCourseAdoptionManager } from "@/components/parish-course-adoption-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseAvailableCourses = [
  { id: "course-001", title: "Catechesis 101", description: "Intro course", published: true, scope: "PARISH" as const },
  { id: "course-002", title: "Advanced Studies", description: "Advanced course", published: true, scope: "PARISH" as const },
];

const baseAdoptedCourses = [
  { id: "course-003", title: "Parish Life", description: "Already adopted", published: true, scope: "PARISH" as const },
];

describe("ParishCourseAdoptionManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows success message after adopting a course", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adopt course" }));

    expect(await screen.findByText("Course adopted for this parish.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/parish-admin/course-adoptions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows error message when adoption request rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adopt course" }));

    expect(await screen.findByText("Failed to adopt course.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adopt course" })).toBeEnabled();
  });

  it("shows error message when adoption response is non-ok with json error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Course already adopted" }),
    } as Response);

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adopt course" }));

    expect(await screen.findByText("Course already adopted")).toBeInTheDocument();
  });

  it("shows fallback error when adoption response is not json", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response);

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adopt course" }));

    expect(await screen.findByText("Failed to adopt course.")).toBeInTheDocument();
  });

  it("shows success message after removing a course", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Course removed from parish adoptions.")).toBeInTheDocument();
  });

  it("shows error message when removal request rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Failed to remove course.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("shows error message when removal response is non-ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not authorized" }),
    } as Response);

    render(
      <ParishCourseAdoptionManager
        adoptedCourses={baseAdoptedCourses}
        availableCourses={baseAvailableCourses}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Not authorized")).toBeInTheDocument();
  });
});
