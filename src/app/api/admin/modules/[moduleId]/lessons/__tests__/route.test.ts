import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { POST } from "@/app/api/admin/modules/[moduleId]/lessons/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("POST /api/admin/modules/[moduleId]/lessons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("creates lesson", async () => {
    const single = vi.fn(async () => ({ data: { id: "l1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never);

    const res = await POST(
      new Request(
        "http://x",
        {
          method: "POST",
          body: JSON.stringify({
            title: "L",
            contentType: "VIDEO",
            youtubeVideoId: "abc",
            sortOrder: 1,
            passingScore: 80,
          }),
        },
      ),
      { params: Promise.resolve({ moduleId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: "VIDEO",
        youtube_video_id: "abc",
        document_url: null,
      }),
    );
  });

  it("creates document lesson", async () => {
    const single = vi.fn(async () => ({ data: { id: "l2" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never);

    const res = await POST(
      new Request(
        "http://x",
        {
          method: "POST",
          body: JSON.stringify({
            title: "Reading",
            contentType: "DOCUMENT",
            documentUrl: "/docs/reading.pdf",
            documentPageStart: 2,
            documentPageEnd: 4,
            sortOrder: 0,
            passingScore: 90,
          }),
        },
      ),
      { params: Promise.resolve({ moduleId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: "DOCUMENT",
        youtube_video_id: null,
        document_url: "/docs/reading.pdf",
        document_page_start: 2,
        document_page_end: 4,
      }),
    );
  });

  it("rejects video lessons without a video id", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    await expect(() =>
      POST(
        new Request(
          "http://x",
          {
            method: "POST",
            body: JSON.stringify({
              title: "Broken video",
              contentType: "VIDEO",
              sortOrder: 0,
              passingScore: 80,
            }),
          },
        ),
        { params: Promise.resolve({ moduleId: "11111111-1111-4111-8111-111111111111" }) },
      ),
    ).rejects.toThrow("YouTube video ID is required for video lessons.");
  });

  it("rejects document lessons with an invalid page range", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    await expect(() =>
      POST(
        new Request(
          "http://x",
          {
            method: "POST",
            body: JSON.stringify({
              title: "Broken reading",
              contentType: "DOCUMENT",
              documentUrl: "/docs/reading.pdf",
              documentPageStart: 5,
              documentPageEnd: 3,
              sortOrder: 0,
              passingScore: 80,
            }),
          },
        ),
        { params: Promise.resolve({ moduleId: "11111111-1111-4111-8111-111111111111" }) },
      ),
    ).rejects.toThrow("Document end page must be greater than or equal to the start page.");
  });
});
