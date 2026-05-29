import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/repositories/certificates", () => ({
  getCertificatePdfData: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

vi.mock("@/lib/certificates/certificate-pdf", () => ({
  CertificateDocument: () => null,
}));

import { renderToBuffer } from "@react-pdf/renderer";

import { GET } from "@/app/api/certificates/[certId]/pdf/route";
import { requireAuth } from "@/lib/authz";
import { getCertificatePdfData } from "@/lib/repositories/certificates";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const cert = {
  id: "cert-1",
  clerk_user_id: "user-1",
  course_id: "course-1",
  issued_at: "2024-01-01T00:00:00.000Z",
};

const pdfData = {
  studentName: "Student One",
  courseTitle: "Course One",
  parishName: "Parish One",
  completionDate: "January 1, 2024",
  courseLessonCount: 0,
};

function certificateQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: cert, error: null })),
      })),
    })),
  };
}

describe("GET /api/certificates/:certId/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(getCertificatePdfData).mockResolvedValue(pdfData);
  });

  it("returns 500 without rendering when modules cannot be loaded", async () => {
    const lessonsFrom = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "certificates") return certificateQuery();
      if (table === "modules") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: null, error: { message: "db down" } })),
          })),
        };
      }
      if (table === "lessons") return lessonsFrom();
      throw new Error(`Unexpected table ${table}`);
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const response = await GET(new Request("http://localhost/api/certificates/cert-1/pdf"), {
      params: Promise.resolve({ certId: "cert-1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not load course lesson count" });
    expect(lessonsFrom).not.toHaveBeenCalled();
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it("returns 500 without rendering when lessons cannot be loaded", async () => {
    const from = vi.fn((table: string) => {
      if (table === "certificates") return certificateQuery();
      if (table === "modules") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [{ id: "module-1" }], error: null })),
          })),
        };
      }
      if (table === "lessons") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: null, error: { message: "db down" } })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const response = await GET(new Request("http://localhost/api/certificates/cert-1/pdf"), {
      params: Promise.resolve({ certId: "cert-1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not load course lesson count" });
    expect(renderToBuffer).not.toHaveBeenCalled();
  });
});
