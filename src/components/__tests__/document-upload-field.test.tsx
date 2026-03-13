import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentUploadField } from "@/components/document-upload-field";

describe("DocumentUploadField", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads a pdf and reports the returned url", async () => {
    const onMessage = vi.fn();
    const onUploaded = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/documents/reading.pdf" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DocumentUploadField onMessage={onMessage} onUploaded={onUploaded} />);

    const input = screen.getByLabelText("Upload PDF");
    fireEvent.change(input, {
      target: {
        files: [new File(["pdf"], "reading.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() =>
      expect(onUploaded).toHaveBeenCalledWith("https://cdn.example.com/documents/reading.pdf"),
    );
    expect(onMessage).toHaveBeenCalledWith("PDF uploaded. Save lesson to keep the document link.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/uploads/documents",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("Uploaded: reading.pdf")).toBeInTheDocument();
  });

  it("reports upload failures", async () => {
    const onMessage = vi.fn();
    const onUploaded = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Only PDF uploads are supported." }),
      }),
    );

    render(<DocumentUploadField onMessage={onMessage} onUploaded={onUploaded} />);

    fireEvent.change(screen.getByLabelText("Upload PDF"), {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    await waitFor(() => expect(onMessage).toHaveBeenCalledWith("Only PDF uploads are supported."));
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
