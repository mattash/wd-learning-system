import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const signUpMock = vi.hoisted(() => ({
  SignUp: vi.fn(() => <div>Sign up</div>),
}));

vi.mock("@clerk/nextjs", () => signUpMock);

import SignUpPage from "@/app/sign-up/[[...sign-up]]/page";
import { SignUp } from "@clerk/nextjs";

describe("SignUpPage", () => {
  it("preserves course enrollment intent in the Clerk redirect", async () => {
    const courseId = "11111111-1111-4111-8111-111111111111";

    render(await SignUpPage({ searchParams: Promise.resolve({ enrollCourseId: courseId }) }));

    expect(SignUp).toHaveBeenCalledWith(
      { forceRedirectUrl: `/app/onboarding?enrollCourseId=${courseId}` },
      undefined,
    );
  });

  it("uses the normal app redirect without enrollment intent", async () => {
    render(await SignUpPage({ searchParams: Promise.resolve({}) }));

    expect(SignUp).toHaveBeenCalledWith({ forceRedirectUrl: "/app" }, undefined);
  });

  it("ignores invalid enrollment course ids", async () => {
    render(await SignUpPage({ searchParams: Promise.resolve({ enrollCourseId: "not-a-course" }) }));

    expect(SignUp).toHaveBeenCalledWith({ forceRedirectUrl: "/app" }, undefined);
  });
});
