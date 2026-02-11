import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { POST } from "@/app/api/admin/lessons/[lessonId]/questions/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("POST /api/admin/lessons/[lessonId]/questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin");
  });

  it("creates question", async () => {
    const single = vi.fn(async () => ({ data: { id: "q1" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never);

    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ prompt: "P", options: ["A", "B"], correctOptionIndex: 1, sortOrder: 0 }) }),
      { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 on invalid correct option", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const res = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ prompt: "P", options: ["A", "B"], correctOptionIndex: 2, sortOrder: 0 }) }),
      { params: Promise.resolve({ lessonId: "11111111-1111-4111-8111-111111111111" }) },
    );
    expect(res.status).toBe(400);
  });
});
