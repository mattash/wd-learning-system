import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminEngagementReport } from "@/components/admin-engagement-report";

const baseParishes = [
  { id: "p1", name: "St. Mary", slug: "st-mary", allow_self_signup: true, archived_at: null, created_at: "2024-01-01" },
  { id: "p2", name: "St. Joseph", slug: "st-joseph", allow_self_signup: true, archived_at: null, created_at: "2024-01-01" },
];

const baseCourses = [
  { id: "c1", title: "Catechesis 101", description: "Intro", thumbnail_url: null, instructor: null, duration_hours: null, category: null, published: true, publicly_browseable: false, scope: "DIOCESE" as const, created_at: "2024-01-01", updated_at: "2024-01-01" },
];

const engagementRow = {
  parish_id: "p1",
  course_id: "c1",
  parish_name: "St. Mary",
  course_title: "Catechesis 101",
  enrollment_count: 10,
  learners_started: 8,
  learners_completed: 5,
  completion_rate: 62.5,
};

const learnerRow = {
  clerk_user_id: "user_abc",
  enrolled_at: "2025-01-15T00:00:00.000Z",
  completed_lessons: 5,
  total_lessons: 10,
  progress_percent: 50,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AdminEngagementReport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and displays engagement rows", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [engagementRow], trends: [] }),
    } as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    expect(await screen.findByText("St. Mary")).toBeInTheDocument();
    expect(screen.getAllByText("Catechesis 101").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error when engagement fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    expect(await screen.findByText("Failed to load engagement report.")).toBeInTheDocument();
  });

  it("shows error and clears rows on non-ok engagement response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server error" }),
    } as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    expect(await screen.findByText("Server error")).toBeInTheDocument();
    expect(screen.getByText("0 engagement records")).toBeInTheDocument();
  });

  it("shows error when engagement response is not json", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    expect(await screen.findByText("Failed to load engagement report.")).toBeInTheDocument();
  });

  it("loads and displays learner drill-down", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [engagementRow], trends: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ learners: [learnerRow] }),
      } as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    await screen.findByText("St. Mary");
    fireEvent.click(screen.getByRole("button", { name: "View learners" }));

    expect(await screen.findByText("user_abc")).toBeInTheDocument();
  });

  it("shows error when learners fetch rejects", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [engagementRow], trends: [] }),
      } as Response)
      .mockRejectedValueOnce(new Error("network error"));

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    await screen.findByText("St. Mary");
    fireEvent.click(screen.getByRole("button", { name: "View learners" }));

    expect(await screen.findByText("Failed to load learner details.")).toBeInTheDocument();
  });

  it("shows error when learners response is non-ok", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [engagementRow], trends: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Database error" }),
      } as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    await screen.findByText("St. Mary");
    fireEvent.click(screen.getByRole("button", { name: "View learners" }));

    expect(await screen.findByText("Database error")).toBeInTheDocument();
  });

  it("shows error when learners response is not json", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [engagementRow], trends: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      } as unknown as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    await screen.findByText("St. Mary");
    fireEvent.click(screen.getByRole("button", { name: "View learners" }));

    expect(await screen.findByText("Failed to load learner details.")).toBeInTheDocument();
  });

  it("clears drill-down when parish filter changes", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [engagementRow], trends: [] }),
    } as Response);

    render(<AdminEngagementReport parishes={baseParishes} courses={baseCourses} />);

    await screen.findByText("St. Mary");
    fireEvent.click(screen.getByRole("button", { name: "View learners" }));

    expect(await screen.findByText("Learner progress drill-down")).toBeInTheDocument();

    // Change parish filter via the first select (parishes)
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "p2" } });

    await waitFor(() => {
      expect(screen.queryByText("Learner progress drill-down")).not.toBeInTheDocument();
    });
  });
});
