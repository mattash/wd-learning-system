import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerMocks.refresh }),
}));

import { RequestJoinButton } from "@/components/course-join/request-join-button";

const courseId = "11111111-1111-4111-8111-111111111111";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("RequestJoinButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.refresh.mockClear();
  });

  it("shows the already-requested state without a join button for a pending request", () => {
    render(<RequestJoinButton courseId={courseId} initiallyRequested />);

    expect(screen.getByText("Request sent")).toBeVisible();
    expect(
      screen.getByText("Your parish admin will review it soon."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Request to Join" }),
    ).not.toBeInTheDocument();
  });

  it("submits a join request and shows the sent state", async () => {
    const fetchMock = mockFetch(201, { request: { id: "r1" } });
    render(<RequestJoinButton courseId={courseId} />);

    fireEvent.click(screen.getByRole("button", { name: "Request to Join" }));

    await waitFor(() => {
      expect(screen.getByText("Request sent")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/student/course-join-requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ courseId }),
      }),
    );
    expect(routerMocks.refresh).toHaveBeenCalled();
  });

  it("surfaces the API error and keeps the button usable when the request fails", async () => {
    mockFetch(400, { error: "A pending request already exists for this course" });
    render(<RequestJoinButton courseId={courseId} />);

    fireEvent.click(screen.getByRole("button", { name: "Request to Join" }));

    await waitFor(() => {
      expect(
        screen.getByText("A pending request already exists for this course"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Request sent")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request to Join" }),
    ).not.toBeDisabled();
  });
});