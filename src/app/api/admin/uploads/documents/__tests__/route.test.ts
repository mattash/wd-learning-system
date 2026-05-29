import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/r2", () => ({
  getDocumentUploadMaxBytes: vi.fn(),
  uploadDocumentToR2: vi.fn(),
}));

import { POST } from "@/app/api/admin/uploads/documents/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getDocumentUploadMaxBytes, uploadDocumentToR2 } from "@/lib/r2";

describe("POST /api/admin/uploads/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
    vi.mocked(getDocumentUploadMaxBytes).mockReturnValue(5 * 1024 * 1024);
  });

  function buildRequest(
    file: { arrayBuffer: () => Promise<ArrayBuffer>; name: string; size: number; type: string } | string | null,
    headers?: Headers,
  ) {
    const requestHeaders = headers ?? new Headers();
    if (!headers && typeof file === "object" && file !== null) {
      requestHeaders.set("content-length", String(file.size));
    }

    return {
      headers: requestHeaders,
      formData: vi.fn().mockResolvedValue({
        get: vi.fn((key: string) => (key === "file" ? file : null)),
      }),
    } as unknown as Request;
  }

  it("uploads a pdf to r2", async () => {
    vi.mocked(uploadDocumentToR2).mockResolvedValue({
      key: "documents/2026/03/test.pdf",
      url: "https://cdn.example.com/documents/2026/03/test.pdf",
    });

    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("%PDF-1.7").buffer),
      name: "reading.pdf",
      size: 8,
      type: "application/pdf",
    };

    const response = await POST(buildRequest(file));

    expect(response.status).toBe(201);
    expect(uploadDocumentToR2).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "application/pdf",
        fileName: "reading.pdf",
      }),
    );
    await expect(response.json()).resolves.toEqual({
      key: "documents/2026/03/test.pdf",
      url: "https://cdn.example.com/documents/2026/03/test.pdf",
    });
  });

  it("rejects non-pdf uploads", async () => {
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("text").buffer),
      name: "notes.txt",
      size: 4,
      type: "text/plain",
    };

    const response = await POST(buildRequest(file));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only PDF uploads are supported.",
    });
    expect(uploadDocumentToR2).not.toHaveBeenCalled();
  });

  it("rejects files with pdf metadata but non-pdf bytes", async () => {
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("not a pdf").buffer),
      name: "payload.pdf",
      size: 9,
      type: "application/pdf",
    };

    const response = await POST(buildRequest(file));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only PDF uploads are supported.",
    });
    expect(uploadDocumentToR2).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads", async () => {
    vi.mocked(getDocumentUploadMaxBytes).mockReturnValue(3);

    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("large-pdf").buffer),
      name: "reading.pdf",
      size: 9,
      type: "application/pdf",
    };

    const response = await POST(buildRequest(file));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF exceeds the 1 MB upload limit.",
    });
  });

  it("rejects oversized content-length before parsing multipart form data", async () => {
    vi.mocked(getDocumentUploadMaxBytes).mockReturnValue(3);

    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("%PDF-large").buffer),
      name: "reading.pdf",
      size: 9,
      type: "application/pdf",
    };
    const request = buildRequest(file, new Headers({ "content-length": String(1024 * 1024 + 4) }));

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF exceeds the 1 MB upload limit.",
    });
    expect(request.formData).not.toHaveBeenCalled();
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(uploadDocumentToR2).not.toHaveBeenCalled();
  });

  it("rejects requests without a valid content-length before parsing multipart form data", async () => {
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("%PDF-1.7").buffer),
      name: "reading.pdf",
      size: 8,
      type: "application/pdf",
    };
    const request = buildRequest(file, new Headers());

    const response = await POST(request);

    expect(response.status).toBe(411);
    await expect(response.json()).resolves.toEqual({
      error: "Content-Length header is required.",
    });
    expect(request.formData).not.toHaveBeenCalled();
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(uploadDocumentToR2).not.toHaveBeenCalled();
  });
});
