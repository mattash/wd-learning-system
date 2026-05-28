import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/admin-membership/route";

describe("POST /api/admin-membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("rejects combined diocese admin and parish membership changes", async () => {
    const from = vi.fn();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          parishId: "11111111-1111-4111-8111-111111111111",
          role: "instructor",
          makeDioceseAdmin: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Only one membership change may be requested at a time" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 400 when diocese upsert fails", async () => {
    const dioceseUpsert = vi.fn(async () => ({ error: { message: "cannot promote" } }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: dioceseUpsert };
        if (table === "parish_memberships") return { upsert: vi.fn() };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          makeDioceseAdmin: true,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "cannot promote" });
  });

  it("returns 400 for invalid request payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          parishId: "not-a-uuid",
          role: "student",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin membership request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin membership request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for no-op membership payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin membership request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for incomplete parish membership payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          parishId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid admin membership request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 when parish membership upsert fails", async () => {
    const membershipUpsert = vi.fn(async () => ({ error: { message: "invalid role" } }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "diocese_admins") return { upsert: vi.fn() };
        if (table === "parish_memberships") return { upsert: membershipUpsert };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin-membership", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: "user-2",
          parishId: "11111111-1111-4111-8111-111111111111",
          role: "student",
          makeDioceseAdmin: false,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid role" });
  });

});
