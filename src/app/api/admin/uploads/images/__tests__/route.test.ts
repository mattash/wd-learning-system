import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/storage/r2", () => ({
  buildImageObjectKey: vi.fn(),
  createPresignedImageUpload: vi.fn(),
  isAllowedImageContentType: vi.fn(),
}));

import { POST } from "@/app/api/admin/uploads/images/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { buildImageObjectKey, createPresignedImageUpload, isAllowedImageContentType } from "@/lib/storage/r2";

describe("POST /api/admin/uploads/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPLOAD_MAX_IMAGE_BYTES;
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
    vi.mocked(isAllowedImageContentType).mockReturnValue(true);
    vi.mocked(buildImageObjectKey).mockReturnValue("module-thumbnails/key.jpg");
    vi.mocked(createPresignedImageUpload).mockResolvedValue({
      uploadUrl: "https://upload.example.com",
      expiresInSeconds: 300,
      objectKey: "module-thumbnails/key.jpg",
      assetUrl: "https://cdn.example.com/module-thumbnails/key.jpg",
    });
  });

  it("returns a presigned upload response for valid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/uploads/images", {
        method: "POST",
        body: JSON.stringify({
          kind: "module",
          fileName: "thumb.jpg",
          contentType: "image/jpeg",
          size: 12345,
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      uploadUrl: "https://upload.example.com",
      expiresInSeconds: 300,
      objectKey: "module-thumbnails/key.jpg",
      assetUrl: "https://cdn.example.com/module-thumbnails/key.jpg",
    });
    expect(buildImageObjectKey).toHaveBeenCalledWith("module", "thumb.jpg", "image/jpeg");
  });

  it("returns 400 for unsupported content type", async () => {
    vi.mocked(isAllowedImageContentType).mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/admin/uploads/images", {
        method: "POST",
        body: JSON.stringify({
          kind: "module",
          fileName: "thumb.bmp",
          contentType: "image/bmp",
          size: 2000,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported image type." });
  });

  it("returns 400 when image exceeds max size", async () => {
    process.env.UPLOAD_MAX_IMAGE_BYTES = "1000";

    const response = await POST(
      new Request("http://localhost/api/admin/uploads/images", {
        method: "POST",
        body: JSON.stringify({
          kind: "lesson",
          fileName: "thumb.png",
          contentType: "image/png",
          size: 1001,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Image too large. Max upload size is 1000 bytes.",
    });
  });
});
