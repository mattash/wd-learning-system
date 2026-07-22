import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompletionModal } from "@/components/completion-modal";

describe("CompletionModal", () => {
  it("does not claim a certificate was issued when no certificate id is available", () => {
    render(
      <CompletionModal
        courseComplete
        courseTitle="Safe Environment"
        lessonTitle="Final quiz"
        nextLesson={null}
        score={100}
      />,
    );

    expect(screen.getByText("Course Complete!")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You have finished all lessons in Safe Environment. Your certificate is being prepared and will be available soon.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/certificate has been issued/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View & Download Certificate" }),
    ).not.toBeInTheDocument();
  });

  it("treats scores at the configured passing threshold as a pass", () => {
    render(
      <CompletionModal
        certificateId="cert-1"
        courseComplete
        courseTitle="Safe Environment"
        lessonTitle="Final quiz"
        nextLesson={null}
        passingScore={80}
        score={80}
      />,
    );

    expect(screen.getByText("Quiz passed")).toBeInTheDocument();
    expect(screen.getByText("Course Complete!")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View & Download Certificate" }),
    ).toHaveAttribute("href", "/app/certificates/cert-1");
  });
});
