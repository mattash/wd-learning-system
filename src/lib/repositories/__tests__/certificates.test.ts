import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/test/supabase-route-mocks";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { checkAndIssueCertificate } from "@/lib/repositories/certificates";

/** Helper: build a certificates table mock that supports .select().eq().eq().maybeSingle() */
function certificatesMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: returnData, error: null })),
          })),
        })),
      })),
    })),
  };
}

function modulesMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ data: returnData, error: null })),
    })),
  };
}

function lessonsMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      in: vi.fn(() => ({ data: returnData, error: null })),
    })),
  };
}

function videoProgressMock(returnData: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => ({ data: returnData, error: null })),
          })),
        })),
      })),
    })),
  };
}

function insertMock(returnData: unknown) {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: returnData, error: null })),
      })),
    })),
  };
}

describe("checkAndIssueCertificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing certificate with newlyIssued=false when certificate already exists", async () => {
    const existingCert = { id: "cert-1", clerk_user_id: "user-1", parish_id: "parish-1", course_id: "course-1", issued_at: "2026-01-01", download_url: null };
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") return certificatesMock(existingCert);
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result = await checkAndIssueCertificate({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(result).toEqual({ certificate: existingCert, newlyIssued: false });
  });

  it("returns null when course has no modules", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") return certificatesMock(null);
        if (table === "modules") return modulesMock([]);
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result = await checkAndIssueCertificate({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when not all lessons are completed", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") return certificatesMock(null);
        if (table === "modules") return modulesMock([{ id: "mod-1" }]);
        if (table === "lessons") return lessonsMock([{ id: "lesson-1" }, { id: "lesson-2" }]);
        if (table === "video_progress") return videoProgressMock([{ lesson_id: "lesson-1", completed: true }]);
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result = await checkAndIssueCertificate({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(result).toBeNull();
  });

  it("issues new certificate with newlyIssued=true when all lessons completed", async () => {
    const newCert = { id: "new-cert", clerk_user_id: "user-1", parish_id: "parish-1", course_id: "course-1", issued_at: "2026-05-01", download_url: null };
    let callCount = 0;
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") {
          callCount++;
          if (callCount === 1) return certificatesMock(null); // check exists
          return insertMock(newCert); // insert new
        }
        if (table === "modules") return modulesMock([{ id: "mod-1" }]);
        if (table === "lessons") return lessonsMock([{ id: "lesson-1" }]);
        if (table === "video_progress") return videoProgressMock([{ lesson_id: "lesson-1", completed: true }]);
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result = await checkAndIssueCertificate({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(result).toEqual({ certificate: newCert, newlyIssued: true });
  });

  it("returns null when certificate insert fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "modules") return modulesMock([{ id: "mod-1" }]);
        if (table === "lessons") return lessonsMock([{ id: "lesson-1" }]);
        if (table === "video_progress") return videoProgressMock([{ lesson_id: "lesson-1", completed: true }]);
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    // Override insert to fail
    let certCallCount = 0;
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") {
          certCallCount++;
          if (certCallCount === 1) {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: null, error: { message: "db error" } })),
              })),
            })),
          };
        }
        if (table === "modules") return modulesMock([{ id: "mod-1" }]);
        if (table === "lessons") return lessonsMock([{ id: "lesson-1" }]);
        if (table === "video_progress") return videoProgressMock([{ lesson_id: "lesson-1", completed: true }]);
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const result = await checkAndIssueCertificate({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(result).toBeNull();
  });
});