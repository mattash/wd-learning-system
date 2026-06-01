import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireParishRole: vi.fn(),
}));

vi.mock("@/lib/repositories/certificates", () => ({
  listStudentCertificates: vi.fn(),
}));

import CertificatesPage from "@/app/app/certificates/page";
import { requireParishRole } from "@/lib/authz";
import {
  type CertificateWithDetails,
  listStudentCertificates,
} from "@/lib/repositories/certificates";

const certificate: CertificateWithDetails = {
  id: "cert-1",
  clerk_user_id: "user-1",
  parish_id: "parish-1",
  course_id: "course-1",
  issued_at: "2026-01-01T00:00:00.000Z",
  download_url: null,
  course_title: "Safe Environment",
  parish_name: "St. Test Parish",
  student_name: "Test Student",
  completion_date: "January 1, 2026",
  lesson_count: 3,
};

describe("CertificatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "user-1",
      parishId: "parish-1",
      role: "student",
    });
    vi.mocked(listStudentCertificates).mockResolvedValue([certificate]);
  });

  it("renders certificate actions as links without nested buttons", async () => {
    render(await CertificatesPage());

    const viewLink = screen.getByRole("link", { name: "View Certificate" });
    const pdfLink = screen.getByRole("link", { name: /PDF/ });

    expect(viewLink).toHaveAttribute("href", "/app/certificates/cert-1");
    expect(pdfLink).toHaveAttribute("href", "/api/certificates/cert-1/pdf");
    expect(pdfLink).toHaveAttribute("target", "_blank");
    expect(pdfLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(viewLink).queryByRole("button")).not.toBeInTheDocument();
    expect(within(pdfLink).queryByRole("button")).not.toBeInTheDocument();
  });
});
