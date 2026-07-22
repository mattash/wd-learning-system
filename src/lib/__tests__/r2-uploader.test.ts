import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  PutObjectCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
  DeleteObjectCommand: class {
    constructor(readonly input: Record<string, unknown>) {}
  },
}));

describe("R2 upload cleanup support", () => {
  beforeEach(() => {
    vi.resetModules();
    send.mockReset();
    process.env.R2_REGION = "auto";
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET = "test-bucket";
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
  });

  it("records an uploaded key only after the R2 write succeeds", async () => {
    send.mockResolvedValue({});
    const { uploadBufferToR2 } = await import("../../../scripts/lib/r2-uploader");
    const onUploaded = vi.fn();

    await expect(
      uploadBufferToR2(Buffer.from("thumbnail"), "lesson-thumbnails/example.png", "image/png", onUploaded),
    ).resolves.toBe("https://cdn.example.com/lesson-thumbnails/example.png");

    expect(onUploaded).toHaveBeenCalledWith("lesson-thumbnails/example.png");
  });

  it("does not record a key when the upload fails", async () => {
    send.mockRejectedValue(new Error("R2 unavailable"));
    const { uploadBufferToR2 } = await import("../../../scripts/lib/r2-uploader");
    const onUploaded = vi.fn();

    await expect(
      uploadBufferToR2(Buffer.from("thumbnail"), "lesson-thumbnails/example.png", "image/png", onUploaded),
    ).rejects.toThrow("R2 unavailable");

    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("deletes a tracked object from the configured bucket", async () => {
    send.mockResolvedValue({});
    const { deleteObjectFromR2 } = await import("../../../scripts/lib/r2-uploader");

    await deleteObjectFromR2("lesson-thumbnails/example.png");

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("validates external thumbnails and returns their HTTP status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { validateExternalUrl } = await import("../../../scripts/lib/r2-uploader");

    await expect(validateExternalUrl("https://images.example.com/thumbnail.png")).resolves.toEqual({
      ok: true,
      status: 204,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://images.example.com/thumbnail.png",
      expect.objectContaining({ method: "HEAD", redirect: "follow" }),
    );
  });

  it("reports external thumbnail validation failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const { validateExternalUrl } = await import("../../../scripts/lib/r2-uploader");

    await expect(validateExternalUrl("https://images.example.com/thumbnail.png", 1)).resolves.toEqual({
      ok: false,
      error: "network unavailable",
    });
  });

  it("reports an aborted thumbnail validation as a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("request aborted")));
    const { validateExternalUrl } = await import("../../../scripts/lib/r2-uploader");

    await expect(validateExternalUrl("https://images.example.com/thumbnail.png", 1)).resolves.toEqual({
      ok: false,
      error: "timed out after 1ms",
    });
  });

  it("rejects inaccessible strict external thumbnails but accepts non-strict URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const { resolveAndUploadThumbnail } = await import("../../../scripts/lib/r2-uploader");
    const url = "https://images.example.com/missing.png";

    await expect(resolveAndUploadThumbnail(url, "thumbnails", "lesson")).resolves.toBe(url);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      resolveAndUploadThumbnail(url, "thumbnails", "lesson", { strict: true }),
    ).rejects.toThrow("External thumbnail URL is inaccessible (404)");
  });
});
