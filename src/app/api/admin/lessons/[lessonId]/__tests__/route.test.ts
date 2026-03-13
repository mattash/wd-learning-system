import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, PATCH } from "@/app/api/admin/lessons/[lessonId]/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/lessons/[lessonId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("updates lesson", async () => {
    const single = vi.fn(async () => ({ data: { id: "l1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);

    const res = await PATCH(
      new Request(
        "http://x",
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "L",
            contentType: "VIDEO",
            youtubeVideoId: "id",
            sortOrder: 1,
            passingScore: 80,
          }),
        },
      ),
      { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: "VIDEO",
        youtube_video_id: "id",
        document_url: null,
      }),
    );
  });

  it("updates lesson to document content", async () => {
    const single = vi.fn(async () => ({ data: { id: "l1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);

    const res = await PATCH(
      new Request(
        "http://x",
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "Reading",
            contentType: "DOCUMENT",
            documentUrl: "/docs/reading.pdf",
            documentPageStart: 5,
            documentPageEnd: 7,
            sortOrder: 1,
            passingScore: 80,
          }),
        },
      ),
      { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: "DOCUMENT",
        youtube_video_id: null,
        document_url: "/docs/reading.pdf",
        document_page_start: 5,
        document_page_end: 7,
      }),
    );
  });

  it("rejects document lessons without a document url", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    await expect(() =>
      PATCH(
        new Request(
          "http://x",
          {
            method: "PATCH",
            body: JSON.stringify({
              title: "Reading",
              contentType: "DOCUMENT",
              sortOrder: 1,
              passingScore: 80,
            }),
          },
        ),
        { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
      ),
    ).rejects.toThrow("Document URL is required for document lessons.");
  });

  it("rejects video lessons without a video id", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    await expect(() =>
      PATCH(
        new Request(
          "http://x",
          {
            method: "PATCH",
            body: JSON.stringify({
              title: "Video",
              contentType: "VIDEO",
              sortOrder: 1,
              passingScore: 80,
            }),
          },
        ),
        { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
      ),
    ).rejects.toThrow("YouTube video ID is required for video lessons.");
  });

  it("deletes lesson", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ delete: del })) } as never);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) });
    expect(res.status).toBe(200);
  });
});
