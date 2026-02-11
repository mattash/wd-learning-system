import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireAuth, requireParishRole } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/progress/route";

describe("POST /api/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "student",
    });
  });

  it("stores progress for active parish", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/progress", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "22222222-2222-4222-8222-222222222222",
          parishId: "11111111-1111-4111-8111-111111111111",
          percentWatched: 90,
          lastPositionSeconds: 120,
          completed: true,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        parish_id: "11111111-1111-4111-8111-111111111111",
        clerk_user_id: "user-1",
        lesson_id: "22222222-2222-4222-8222-222222222222",
        percent_watched: 90,
        last_position_seconds: 120,
        completed: true,
      }),
      { onConflict: "parish_id,clerk_user_id,lesson_id" },
    );
  });

  it("returns 403 for cross-parish payloads", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/progress", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "22222222-2222-4222-8222-222222222222",
          parishId: "33333333-3333-4333-8333-333333333333",
          percentWatched: 10,
          lastPositionSeconds: 30,
          completed: false,
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invalid parish context" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when upsert fails", async () => {
    const upsert = vi.fn(async () => ({ error: { message: "db error" } }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/progress", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "22222222-2222-4222-8222-222222222222",
          parishId: "11111111-1111-4111-8111-111111111111",
          percentWatched: 10,
          lastPositionSeconds: 30,
          completed: false,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "db error" });
  });
});
