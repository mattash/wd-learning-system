import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { POST } from "@/app/api/admin/courses/[courseId]/modules/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("POST /api/admin/courses/[courseId]/modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("creates module", async () => {
    const single = vi.fn(async () => ({ data: { id: "m1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never);

    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ title: "Mod", sortOrder: 1 }) }),
      { params: Promise.resolve({ courseId: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(res.status).toBe(201);
  });
});
