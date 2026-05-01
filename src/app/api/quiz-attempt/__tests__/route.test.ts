import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/test/supabase-route-mocks";

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/repositories/lessons", () => ({
  isUserEnrolledForLesson: vi.fn(),
  getCourseIdForLesson: vi.fn(),
}));

vi.mock("@/lib/repositories/certificates", () => ({
  checkAndIssueCertificate: vi.fn(),
}));

vi.mock("@/lib/parish-communications/notifications", () => ({
  notifyCourseCompletion: vi.fn().mockResolvedValue(undefined),
}));

import { requireAuth, requireParishRole } from "@/lib/authz";
import { isUserEnrolledForLesson, getCourseIdForLesson } from "@/lib/repositories/lessons";
import { checkAndIssueCertificate } from "@/lib/repositories/certificates";
import { notifyCourseCompletion } from "@/lib/parish-communications/notifications";
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
    vi.mocked(isUserEnrolledForLesson).mockResolvedValue(true);
    vi.mocked(getCourseIdForLesson).mockResolvedValue(null);
    vi.mocked(checkAndIssueCertificate).mockResolvedValue(null);
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
    const json = await response.json();
    expect(json).toMatchObject({ ok: true, score: 50, total: 2, certificateId: null });
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

  it("returns 403 when learner is not enrolled in the lesson course", async () => {
    vi.mocked(isUserEnrolledForLesson).mockResolvedValue(false);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

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

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Enrollment required for this lesson" });
  });

  it("issues certificate and triggers notification when course is completed", async () => {
    vi.mocked(getCourseIdForLesson).mockResolvedValue("course-1");
    vi.mocked(checkAndIssueCertificate).mockResolvedValue({
      certificate: { id: "cert-new", clerk_user_id: "user-1", parish_id: "11111111-1111-4111-8111-111111111111", course_id: "course-1", issued_at: "2026-05-01", download_url: null },
      newlyIssued: true,
    });

    const insert = vi.fn(async () => ({ error: null }));
    const order = vi.fn(async () => ok([{ correct_option_index: 1 }]));
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
          answers: [1],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ ok: true, score: 100, total: 1, certificateId: "cert-new" });
    expect(checkAndIssueCertificate).toHaveBeenCalledWith({
      clerkUserId: "user-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      courseId: "course-1",
    });
    expect(notifyCourseCompletion).toHaveBeenCalledWith({
      clerkUserId: "user-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      courseId: "course-1",
    });
  });

  it("does not trigger notification when certificate already existed", async () => {
    vi.mocked(getCourseIdForLesson).mockResolvedValue("course-1");
    vi.mocked(checkAndIssueCertificate).mockResolvedValue({
      certificate: { id: "cert-old", clerk_user_id: "user-1", parish_id: "11111111-1111-4111-8111-111111111111", course_id: "course-1", issued_at: "2026-04-01", download_url: null },
      newlyIssued: false,
    });

    const insert = vi.fn(async () => ({ error: null }));
    const order = vi.fn(async () => ok([{ correct_option_index: 1 }]));
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
          answers: [1],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ ok: true, certificateId: "cert-old" });
    expect(notifyCourseCompletion).not.toHaveBeenCalled();
  });
});