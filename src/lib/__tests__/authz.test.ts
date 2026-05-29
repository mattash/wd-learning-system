import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(() => false),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { clerkClient } from "@clerk/nextjs/server";

import { getUserLabel, hasCompletedOnboarding } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function createQuery(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: result })),
  };

  return query;
}

describe("hasCompletedOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires both profile completion and a parish membership", async () => {
    const profileQuery = createQuery({ onboarding_completed_at: "2024-01-01T00:00:00.000Z" });
    const membershipQuery = createQuery({ parish_id: "parish-1" });
    const from = vi.fn((table: string) => (table === "user_profiles" ? profileQuery : membershipQuery));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(hasCompletedOnboarding("user-1")).resolves.toBe(true);

    expect(from).toHaveBeenCalledWith("user_profiles");
    expect(from).toHaveBeenCalledWith("parish_memberships");
  });

  it("keeps users with a completed profile but no membership in onboarding", async () => {
    const profileQuery = createQuery({ onboarding_completed_at: "2024-01-01T00:00:00.000Z" });
    const membershipQuery = createQuery(null);
    const from = vi.fn((table: string) => (table === "user_profiles" ? profileQuery : membershipQuery));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(hasCompletedOnboarding("user-1")).resolves.toBe(false);

    expect(membershipQuery.eq).toHaveBeenCalledWith("clerk_user_id", "user-1");
  });

  it("does not check memberships until profile completion exists", async () => {
    const profileQuery = createQuery({ onboarding_completed_at: null });
    const from = vi.fn(() => profileQuery);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(hasCompletedOnboarding("user-1")).resolves.toBe(false);

    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("getUserLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to email when the Clerk user has no name", async () => {
    const getUser = vi.fn(async () => ({
      fullName: null,
      firstName: null,
      lastName: null,
      primaryEmailAddress: { emailAddress: "user@example.com" },
    }));
    vi.mocked(clerkClient).mockResolvedValue({
      users: { getUser },
    } as never);

    await expect(getUserLabel("clerk-user-1")).resolves.toBe("user@example.com");

    expect(getUser).toHaveBeenCalledWith("clerk-user-1");
  });
});
