import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { DELETE, PATCH } from "@/app/api/admin/questions/[questionId]/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/questions/[questionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("updates question", async () => {
    const single = vi.fn(async () => ({ data: { id: "q1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);

    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ prompt: "P", options: ["A", "B"], correctOptionIndex: 1, sortOrder: 0 }) }),
      { params: Promise.resolve({ questionId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(200);
  });

  it("deletes question", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const del = vi.fn(() => ({ eq }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ delete: del })) } as never);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ questionId: "11111111-1111-4111-8111-111111111111" }) });
    expect(res.status).toBe(200);
  });
});
