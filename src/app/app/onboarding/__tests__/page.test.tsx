import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.hoisted(() => vi.fn());
const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}));

vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  hasCompletedOnboarding: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(),
}));

vi.mock("@/lib/repositories/course-join-requests", () => ({
  createJoinRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { clerkClient } from "@clerk/nextjs/server";

import OnboardingPage from "@/app/app/onboarding/page";
import { hasCompletedOnboarding, requireAuth } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { createJoinRequest } from "@/lib/repositories/course-join-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function findFormAction(node: React.ReactNode): ((formData: FormData) => Promise<void>) | null {
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<{
    action?: (formData: FormData) => Promise<void>;
    children?: React.ReactNode;
  }>;

  if (element.type === "form" && typeof element.props.action === "function") {
    return element.props.action;
  }

  for (const child of React.Children.toArray(element.props.children)) {
    const action = findFormAction(child);
    if (action) return action;
  }

  return null;
}

const courseId = "11111111-1111-4111-8111-111111111111";
const parishId = "22222222-2222-4222-8222-222222222222";

function mockSupabase() {
  const profileMaybeSingle = vi.fn(async () => ({ data: { display_name: "Student One" }, error: null }));
  const parishesOrder = vi.fn(async () => ({
    data: [{ id: parishId, name: "St Mary", slug: "st-mary" }],
    error: null,
  }));
  const parishMaybeSingle = vi.fn(async () => ({ data: { id: parishId }, error: null }));
  const membershipUpsert = vi.fn(async () => ({ error: null }));
  const profileUpsert = vi.fn(async () => ({ error: null }));

  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: profileMaybeSingle })),
          })),
          upsert: profileUpsert,
        };
      }

      if (table === "parishes") {
        return {
          select: vi.fn((columns: string) => {
            if (columns === "id,name,slug") {
              return {
                eq: vi.fn(() => ({ order: parishesOrder })),
              };
            }

            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({ maybeSingle: parishMaybeSingle })),
              })),
            };
          }),
        };
      }

      if (table === "parish_memberships") {
        return { upsert: membershipUpsert };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  } as never);
}

describe("OnboardingPage enrollment intent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(hasCompletedOnboarding).mockResolvedValue(false);
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
    vi.mocked(createJoinRequest).mockResolvedValue({
      id: "request-1",
      parishId,
      clerkUserId: "user-1",
      courseId,
      status: "PENDING",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn(async () => ({
          primaryEmailAddressId: "email-1",
          primaryEmailAddress: { emailAddress: "student@example.com" },
          emailAddresses: [{ id: "email-1", emailAddress: "student@example.com" }],
        })),
      },
    } as never);
    mockSupabase();
  });

  it("submits the intended course join request after onboarding succeeds", async () => {
    const page = await OnboardingPage({ searchParams: Promise.resolve({ enrollCourseId: courseId }) });
    const action = findFormAction(page);
    expect(action).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("displayName", "Student One");
    formData.set("parishId", parishId);
    formData.set("enrollCourseId", courseId);

    await expect(action?.(formData)).rejects.toThrow("NEXT_REDIRECT:/app/catalog?enrollment=requested");
    expect(createJoinRequest).toHaveBeenCalledWith({ parishId, clerkUserId: "user-1", courseId });
  });

  it("completes onboarding normally when no enrollment intent is present", async () => {
    const page = await OnboardingPage({ searchParams: Promise.resolve({}) });
    const action = findFormAction(page);
    expect(action).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("displayName", "Student One");
    formData.set("parishId", parishId);

    await expect(action?.(formData)).rejects.toThrow("NEXT_REDIRECT:/app");
    expect(createJoinRequest).not.toHaveBeenCalled();
  });

  it("treats an existing pending request as successful enrollment intent", async () => {
    vi.mocked(createJoinRequest).mockRejectedValue(new Error("A pending request already exists for this course"));
    const page = await OnboardingPage({ searchParams: Promise.resolve({ enrollCourseId: courseId }) });
    const action = findFormAction(page);

    const formData = new FormData();
    formData.set("displayName", "Student One");
    formData.set("parishId", parishId);
    formData.set("enrollCourseId", courseId);

    await expect(action?.(formData)).rejects.toThrow("NEXT_REDIRECT:/app/catalog?enrollment=requested");
  });

  it("does not block onboarding when enrollment intent cannot be submitted", async () => {
    vi.mocked(createJoinRequest).mockRejectedValue(new Error("course deleted"));
    const page = await OnboardingPage({ searchParams: Promise.resolve({ enrollCourseId: courseId }) });
    const action = findFormAction(page);

    const formData = new FormData();
    formData.set("displayName", "Student One");
    formData.set("parishId", parishId);
    formData.set("enrollCourseId", courseId);

    await expect(action?.(formData)).rejects.toThrow("NEXT_REDIRECT:/app");
  });
});
