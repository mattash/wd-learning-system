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

  function buildRequest(file: { arrayBuffer: () => Promise<ArrayBuffer>; name: string; size: number; type: string } | string | null) {
    return {
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
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
      name: "reading.pdf",
      size: 3,
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
});
