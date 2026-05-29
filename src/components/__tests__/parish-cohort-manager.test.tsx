import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParishCohortManager } from "@/components/parish-cohort-manager";
import type {
  ParishAdminCohortRow,
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
  beforeEach(() => {
    vi.restoreAllMocks();
    refresh.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("creates a cohort for users who can manage all", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    renderManager(true);

    fireEvent.change(screen.getByPlaceholderText("Cohort name"), { target: { value: "New Cohort" } });
    fireEvent.click(screen.getByRole("button", { name: "Create cohort" }));

    expect(await screen.findByText("Cohort created.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/parish-admin/cohorts",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("New Cohort"),
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("saves existing cohort edits for users who can manage all", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    renderManager(true);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Cohort updated.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/parish-admin/cohorts/cohort-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("deletes a cohort for users who can manage all", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    renderManager(true);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Cohort deleted.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/parish-admin/cohorts/cohort-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("updates enrollment assignments for users who can manage all", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    renderManager(true);

    fireEvent.click(screen.getByRole("button", { name: "Update assignment" }));

    expect(await screen.findByText("Enrollment assignment updated.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/parish-admin/cohort-assignments",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("enrollment-1"),
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a fallback message when cohort creation rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    renderManager(true);

    fireEvent.change(screen.getByPlaceholderText("Cohort name"), { target: { value: "New Cohort" } });
    fireEvent.click(screen.getByRole("button", { name: "Create cohort" }));

    expect(await screen.findByText("Failed to create cohort.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows API errors when saving a cohort fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not authorized" }),
    } as Response);

    renderManager(true);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Not authorized")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows fallback messages when deleting a cohort returns invalid JSON", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    } as unknown as Response);

    renderManager(true);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Failed to delete cohort.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders empty cohort and enrollment states", () => {
    render(
      <ParishCohortManager
        canManageAll={true}
        cohorts={[]}
        courses={courses}
        enrollments={[]}
        members={members}
      />,
    );

    expect(screen.getByText("No cohorts created yet.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No enrollments available" })).toBeInTheDocument();
  });
});
