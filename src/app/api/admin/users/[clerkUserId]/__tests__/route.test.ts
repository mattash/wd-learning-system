import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { PATCH } from "@/app/api/admin/users/[clerkUserId]/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("PATCH /api/admin/users/[clerkUserId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("updates the user profile", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        clerk_user_id: "user-1",
        email: "alice@example.com",
        display_name: "Alice",
        onboarding_completed_at: null,
        created_at: "2024-01-01",
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ displayName: "  Alice ", email: " alice@example.com " }),
      }),
      { params: Promise.resolve({ clerkUserId: "user-1" }) },
    );

    expect(update).toHaveBeenCalledWith({ display_name: "Alice", email: "alice@example.com" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        clerk_user_id: "user-1",
        email: "alice@example.com",
        display_name: "Alice",
        onboarding_completed_at: null,
        created_at: "2024-01-01",
      },
    });
  });

  it("returns 400 for invalid payload", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn() } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ clerkUserId: "user-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "At least one profile field is required" });
  });

  it("returns 404 when profile is missing", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ displayName: "Alice" }),
      }),
      { params: Promise.resolve({ clerkUserId: "user-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "User profile not found" });
  });

  it("returns 400 when update fails", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: { message: "update failed" } }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ update })),
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ displayName: "Alice" }),
      }),
      { params: Promise.resolve({ clerkUserId: "user-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "update failed" });
  });
});
