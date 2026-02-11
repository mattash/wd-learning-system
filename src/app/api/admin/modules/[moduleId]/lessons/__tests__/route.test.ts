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
      new Request("http://x", { method: "POST", body: JSON.stringify({ title: "L", youtubeVideoId: "abc", sortOrder: 1, passingScore: 80 }) }),
      { params: Promise.resolve({ moduleId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(201);
  });
});
