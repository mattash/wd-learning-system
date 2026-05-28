import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(() => false),
}));

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import {
  checkAndIssueCertificate,
  listStudentCertificates,
  getCertificatePdfData,
} from "@/lib/repositories/certificates";

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
    let certCallCount = 0;
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") {
          certCallCount++;
          if (certCallCount === 1) {
            return certificatesMock(null);
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

  it("returns null in e2e smoke mode", async () => {
    vi.mocked(isE2ESmokeMode).mockReturnValue(true);

    const result = await checkAndIssueCertificate({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when course has modules but no lessons", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "certificates") return certificatesMock(null);
        if (table === "modules") return modulesMock([{ id: "mod-1" }]);
        if (table === "lessons") return lessonsMock([]);
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

describe("listStudentCertificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  function fromMock(tables: Record<string, unknown>) {
    return vi.fn((table: string) => {
      const mock = tables[table];
      if (!mock) throw new Error(`Unexpected table "${table}" in test mock`);
      return mock;
    });
  }

  it("returns empty array in e2e smoke mode", async () => {
    vi.mocked(isE2ESmokeMode).mockReturnValue(true);
    const result = await listStudentCertificates("user-1", "parish-1");
    expect(result).toEqual([]);
  });

  it("returns empty array when certificates query errors", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({ data: null, error: { message: "db error" } })),
              })),
            })),
          })),
        },
      }),
    } as never);

    const result = await listStudentCertificates("user-1", "parish-1");
    expect(result).toEqual([]);
  });

  it("returns enriched certificates with parish name and student name and lesson counts", async () => {
    const certs = [
      { id: "cert-1", clerk_user_id: "user-1", parish_id: "parish-1", course_id: "course-1", issued_at: "2026-01-15T00:00:00Z", download_url: null },
      { id: "cert-2", clerk_user_id: "user-1", parish_id: "parish-1", course_id: "course-2", issued_at: "2026-02-20T00:00:00Z", download_url: null },
    ];

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({ data: certs, error: null })),
              })),
            })),
          })),
        },
        courses: {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: "course-1", title: "Armenian 101" },
                { id: "course-2", title: "Bible Study" },
              ],
              error: null,
            })),
          })),
        },
        parishes: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { name: "St. John" }, error: null })),
            })),
          })),
        },
        user_profiles: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { display_name: "John Doe" }, error: null })),
            })),
          })),
        },
        modules: {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: "mod-1", course_id: "course-1" },
                { id: "mod-2", course_id: "course-2" },
              ],
              error: null,
            })),
          })),
        },
        lessons: {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                { id: "lesson-1", module_id: "mod-1" },
                { id: "lesson-2", module_id: "mod-1" },
                { id: "lesson-3", module_id: "mod-2" },
              ],
              error: null,
            })),
          })),
        },
      }),
    } as never);

    const result = await listStudentCertificates("user-1", "parish-1");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ course_title: "Armenian 101", parish_name: "St. John", student_name: "John Doe", lesson_count: 2 });
    expect(result[1]).toMatchObject({ course_title: "Bible Study", parish_name: "St. John", student_name: "John Doe", lesson_count: 1 });
  });

  it("returns empty array when certificates query returns null data", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
        },
      }),
    } as never);

    const result = await listStudentCertificates("user-1", "parish-1");
    expect(result).toEqual([]);
  });
  it("uses fallback values when enrichment data is missing", async () => {
    const certs = [
      { id: "cert-1", clerk_user_id: "user-1", parish_id: "parish-1", course_id: "course-1", issued_at: "2026-01-15T00:00:00Z", download_url: null },
    ];

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({ data: certs, error: null })),
              })),
            })),
          })),
        },
        courses: {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: null, error: null })),
          })),
        },
        parishes: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        },
        user_profiles: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        },
        modules: {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: null, error: null })),
          })),
        },
        lessons: {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: null, error: null })),
          })),
        },
      }),
    } as never);

    const result = await listStudentCertificates("user-1", "parish-1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      course_title: "Unknown Course",
      parish_name: "Unknown Parish",
      student_name: "user-1",
      lesson_count: 0,
    });
  });
});

describe("getCertificatePdfData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  function fromMock(tables: Record<string, unknown>) {
    return vi.fn((table: string) => {
      const mock = tables[table];
      if (!mock) throw new Error(`Unexpected table "${table}" in test mock`);
      return mock;
    });
  }

  it("returns null in e2e smoke mode", async () => {
    vi.mocked(isE2ESmokeMode).mockReturnValue(true);
    const result = await getCertificatePdfData("cert-1");
    expect(result).toBeNull();
  });

  it("returns null when certificate not found", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        },
      }),
    } as never);

    const result = await getCertificatePdfData("cert-1");
    expect(result).toBeNull();
  });

  it("returns certificate pdf data with correct fields", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  clerk_user_id: "user-1",
                  parish_id: "parish-1",
                  course_id: "course-1",
                  issued_at: "2026-03-15T12:00:00Z",
                },
                error: null,
              })),
            })),
          })),
        },
        parishes: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { name: "St. John" }, error: null })),
            })),
          })),
        },
        user_profiles: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { display_name: "John Doe" }, error: null })),
            })),
          })),
        },
        courses: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { title: "Armenian 101" }, error: null })),
            })),
          })),
        },
      }),
    } as never);

    const result = await getCertificatePdfData("cert-1");
    expect(result).toEqual({
      studentName: "John Doe",
      courseTitle: "Armenian 101",
      parishName: "St. John",
      completionDate: "March 15, 2026",
      courseLessonCount: 0,
    });
  });

  it("returns empty array when course not found during pdf data lookup", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock({
        certificates: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  clerk_user_id: "user-1",
                  parish_id: "parish-1",
                  course_id: "course-1",
                  issued_at: "2026-03-15T12:00:00Z",
                },
                error: null,
              })),
            })),
          })),
        },
        parishes: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { name: "St. John" }, error: null })),
            })),
          })),
        },
        user_profiles: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { display_name: "John Doe" }, error: null })),
            })),
          })),
        },
        courses: {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        },
      }),
    } as never);

    const result = await getCertificatePdfData("cert-1");
    expect(result).toMatchObject({
      courseTitle: "Unknown Course",
      parishName: "St. John",
      studentName: "John Doe",
    });
  });
});