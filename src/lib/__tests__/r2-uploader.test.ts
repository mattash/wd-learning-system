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
});
