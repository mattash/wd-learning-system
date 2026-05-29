import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSignedUrlMock, s3ClientMock, putObjectCommandMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(),
  putObjectCommandMock: vi.fn(function PutObjectCommand(input: unknown) {
    return { input };
  }),
  s3ClientMock: vi.fn(function S3Client(config: unknown) {
    return { config };
  }),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: vi.fn(),
  PutObjectCommand: putObjectCommandMock,
  S3Client: s3ClientMock,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { createPresignedImageUpload } from "@/lib/storage/r2";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

describe("createPresignedImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_ACCOUNT_ID = "account";
    process.env.R2_ACCESS_KEY_ID = "access-key";
    process.env.R2_SECRET_ACCESS_KEY = "secret-key";
    process.env.R2_BUCKET = "bucket";
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
    delete process.env.R2_ENDPOINT;
    delete process.env.R2_REGION;
    getSignedUrlMock.mockResolvedValue("https://upload.example.com");
  });

  it("rejects unsupported image content types before presigning", async () => {
    await expect(
      createPresignedImageUpload({
        key: "course-thumbnails/key.html",
        contentType: "text/html",
      }),
    ).rejects.toThrow("Unsupported image content type: text/html");

    expect(getSignedUrl).not.toHaveBeenCalled();
    expect(s3ClientMock).not.toHaveBeenCalled();
  });

  it("presigns allowed image content types", async () => {
    await expect(
      createPresignedImageUpload({
        key: "course-thumbnails/key.jpg",
        contentType: "image/jpeg",
      }),
    ).resolves.toEqual({
      uploadUrl: "https://upload.example.com",
      expiresInSeconds: 300,
      objectKey: "course-thumbnails/key.jpg",
      assetUrl: "https://cdn.example.com/course-thumbnails/key.jpg",
    });

    expect(putObjectCommandMock).toHaveBeenCalledWith({
      Bucket: "bucket",
      Key: "course-thumbnails/key.jpg",
      ContentType: "image/jpeg",
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      {
        input: {
          Bucket: "bucket",
          Key: "course-thumbnails/key.jpg",
          ContentType: "image/jpeg",
        },
      },
      { expiresIn: 300 },
    );
  });
});
