import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireDioceseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET } from "@/app/api/admin/engagement/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/admin/engagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("returns enriched engagement rows", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [{ parish_id: "p1", course_id: "c1", learners_started: 10, learners_completed: 7 }],
        error: null,
      })),
      from: vi.fn((table: string) => {
        if (table === "parishes") return { select: vi.fn(async () => ({ data: [{ id: "p1", name: "St Mary" }], error: null })) };
        if (table === "courses") return { select: vi.fn(async () => ({ data: [{ id: "c1", title: "Alpha" }], error: null })) };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      engagement: [
        {
          parish_id: "p1",
          course_id: "c1",
          learners_started: 10,
          learners_completed: 7,
          parish_name: "St Mary",
          course_title: "Alpha",
        },
      ],
    });
  });
});
