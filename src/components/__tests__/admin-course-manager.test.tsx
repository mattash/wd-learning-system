import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminCourseManager } from "@/components/admin-course-manager";
import type { DioceseCourseRow } from "@/lib/repositories/diocese-admin";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const courses: DioceseCourseRow[] = [
  {
    id: "course-1",
    title: "Foundations",
    description: null,
    thumbnail_url: null,
    scope: "DIOCESE",
    published: true,
    publicly_browseable: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("AdminCourseManager", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reenables course creation when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    render(<AdminCourseManager courses={courses} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create course" }));
    const dialog = screen.getByRole("dialog", { name: "Create course" });

    fireEvent.change(within(dialog).getByLabelText(/Title/), { target: { value: "New course" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create course" }));

    expect(await within(dialog).findByText("Failed to create course.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create course" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback create failure when an error response has invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );

    render(<AdminCourseManager courses={courses} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Create course" }));
    const dialog = screen.getByRole("dialog", { name: "Create course" });

    fireEvent.change(within(dialog).getByLabelText(/Title/), { target: { value: "New course" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create course" }));

    expect(await within(dialog).findByText("Failed to create course.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create course" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reenables course deletion when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    render(<AdminCourseManager courses={courses} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete course?" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete course" }));

    expect(await screen.findByText("Failed to delete course.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete course" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback delete failure when an error response has invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );

    render(<AdminCourseManager courses={courses} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete course?" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete course" }));

    expect(await screen.findByText("Failed to delete course.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete course" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
