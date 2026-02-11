import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/test/supabase-route-mocks";

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireAuth, requireParishRole } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/quiz-attempt/route";

describe("POST /api/quiz-attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "student",
    });
  });

  it("grades and stores quiz attempts", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const order = vi.fn(async () =>
      ok([
        { correct_option_index: 1 },
        { correct_option_index: 0 },
      ]),
    );
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "questions") return { select };
        if (table === "quiz_attempts") return { insert };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/quiz-attempt", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "22222222-2222-4222-8222-222222222222",
          parishId: "11111111-1111-4111-8111-111111111111",
          answers: [1, 1],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, score: 50, total: 2 });
    expect(insert).toHaveBeenCalledWith({
      parish_id: "11111111-1111-4111-8111-111111111111",
      clerk_user_id: "user-1",
      lesson_id: "22222222-2222-4222-8222-222222222222",
      answers: [1, 1],
      score: 50,
    });
  });

  it("returns 403 when payload parish does not match active parish", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    const response = await POST(
      new Request("http://localhost/api/quiz-attempt", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "22222222-2222-4222-8222-222222222222",
          parishId: "33333333-3333-4333-8333-333333333333",
          answers: [1],
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Invalid parish context" });
  });

  it("returns 400 when question lookup fails", async () => {
    const order = vi.fn(async () => fail("boom"));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "questions") return { select };
        if (table === "quiz_attempts") return { insert: vi.fn() };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/quiz-attempt", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "22222222-2222-4222-8222-222222222222",
          parishId: "11111111-1111-4111-8111-111111111111",
          answers: [1],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Could not fetch questions" });
  });
});
