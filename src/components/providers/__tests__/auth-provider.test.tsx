import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children, publishableKey }: { children: React.ReactNode; publishableKey: string }) => (
    <div data-publishable-key={publishableKey} data-testid="clerk-provider">
      {children}
    </div>
  ),
}));

import { AuthProvider } from "@/components/providers/auth-provider";

describe("AuthProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("wraps children with ClerkProvider when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_123");

    render(
      <AuthProvider>
        <span>Protected app</span>
      </AuthProvider>,
    );

    expect(screen.getByTestId("clerk-provider")).toHaveAttribute("data-publishable-key", "pk_test_123");
    expect(screen.getByText("Protected app")).toBeInTheDocument();
  });

  it("fails closed when the Clerk publishable key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");

    expect(() =>
      render(
        <AuthProvider>
          <span>Protected app</span>
        </AuthProvider>,
      ),
    ).toThrow("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  });
});
