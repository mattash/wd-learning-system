import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentReviewCard } from "@/components/document-review-card";

describe("DocumentReviewCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks a document section as reviewed", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    render(
      <DocumentReviewCard
        documentLabel="Pages 2-4"
        documentUrl="/docs/reading.pdf#page=2"
        initiallyCompleted={false}
        lessonId="11111111-1111-4111-8111-111111111111"
        parishId="22222222-2222-4222-8222-222222222222"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark section reviewed" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/progress",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            lessonId: "11111111-1111-4111-8111-111111111111",
            parishId: "22222222-2222-4222-8222-222222222222",
            percentWatched: 100,
            lastPositionSeconds: 0,
            completed: true,
          }),
        }),
      ),
    );

    expect(await screen.findByText("Section marked as reviewed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Section reviewed" })).toBeDisabled();
  });

  it("shows an error when progress saving fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "db error" }),
    } as Response);

    render(
      <DocumentReviewCard
        documentLabel="Assigned document"
        documentUrl="/docs/reading.pdf"
        initiallyCompleted={false}
        lessonId="11111111-1111-4111-8111-111111111111"
        parishId="22222222-2222-4222-8222-222222222222"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark section reviewed" }));

    expect(await screen.findByText("db error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark section reviewed" })).toBeEnabled();
  });

  it("reenables review action when the progress request rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(
      <DocumentReviewCard
        documentLabel="Assigned document"
        documentUrl="/docs/reading.pdf"
        initiallyCompleted={false}
        lessonId="11111111-1111-4111-8111-111111111111"
        parishId="22222222-2222-4222-8222-222222222222"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark section reviewed" }));

    expect(await screen.findByText("Unable to update review status.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark section reviewed" })).toBeEnabled();
  });

  it("reenables review action when the error response is not json", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as Response);

    render(
      <DocumentReviewCard
        documentLabel="Assigned document"
        documentUrl="/docs/reading.pdf"
        initiallyCompleted={false}
        lessonId="11111111-1111-4111-8111-111111111111"
        parishId="22222222-2222-4222-8222-222222222222"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark section reviewed" }));

    expect(await screen.findByText("Unable to update review status.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark section reviewed" })).toBeEnabled();
  });
});
