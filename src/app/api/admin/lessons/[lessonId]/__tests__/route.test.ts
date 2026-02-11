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
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ title: "L", youtubeVideoId: "id", sortOrder: 1, passingScore: 80 }) }),
      { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(200);
  });

  it("deletes lesson", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ delete: del })) } as never);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) });
    expect(res.status).toBe(200);
  });
});
