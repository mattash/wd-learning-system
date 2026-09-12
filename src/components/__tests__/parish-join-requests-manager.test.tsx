import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function mockFetch(response: Partial<Response>) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  } as Response);
}

describe("ParishJoinRequestsManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("approves a pending request and shows a success message", async () => {
    mockFetch({ ok: true });

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getByText("Enrollment created and request approved.")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/parish-admin/course-join-requests/request-1/approve",
      expect.objectContaining({ method: "POST" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    });
  });

  it("shows an error when approval fails", async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ error: "Already enrolled" }) });

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getByText("Already enrolled")).toBeInTheDocument();
    });
  });

  it("shows a network error when approval cannot reach the server", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getByText("Network error — please try again")).toBeInTheDocument();
    });
  });

  it("rejects a pending request and shows a success message", async () => {
    mockFetch({ ok: true });

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(screen.getByText("Request rejected.")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/parish-admin/course-join-requests/request-1/reject",
      expect.objectContaining({ method: "POST" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    });
  });

  it("shows an error when rejection fails", async () => {
    mockFetch({ ok: false, status: 400, json: async () => ({ error: "Request not found" }) });

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(screen.getByText("Request not found")).toBeInTheDocument();
    });
  });

  it("shows a network error when rejection cannot reach the server", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(screen.getByText("Network error — please try again")).toBeInTheDocument();
    });
  });

  it("renders empty state when there are no pending requests", () => {
    render(<ParishJoinRequestsManager initialRequests={[]} />);

    expect(screen.getByText("No pending requests.")).toBeInTheDocument();
  });

  it("disables action buttons while a request is being processed", async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.spyOn(global, "fetch").mockReturnValue(fetchPromise);

    render(<ParishJoinRequestsManager initialRequests={[baseRequest]} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getAllByText("...").length).toBe(2);
    });

    resolveFetch!({ ok: true, status: 200, json: async () => ({}) } as Response);

    await waitFor(() => {
      expect(screen.queryAllByText("...").length).toBe(0);
    });
  });

  it("renders approved and rejected requests without action buttons", () => {
    render(
      <ParishJoinRequestsManager
        initialRequests={[
          { ...baseRequest, id: "approved-1", status: "APPROVED" },
          { ...baseRequest, id: "rejected-1", status: "REJECTED" },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });
});
