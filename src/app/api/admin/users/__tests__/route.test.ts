import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { GET } from "@/app/api/admin/users/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function createUserProfilesQuery({
  data,
  error = null,
  onIn,
  events,
}: {
  data: unknown[];
  error?: { message: string } | null;
  onIn?: (column: string, values: string[]) => void;
  events?: string[];
}) {
  const query = {
    or: vi.fn(() => {
      events?.push("or");
      return query;
    }),
    not: vi.fn(() => {
      events?.push("not");
      return query;
    }),
    is: vi.fn(() => {
      events?.push("is");
      return query;
    }),
    in: vi.fn((column: string, values: string[]) => {
      events?.push("in");
      onIn?.(column, values);
      return query;
    }),
    order: vi.fn(() => {
      events?.push("order");
      return {
        limit: vi.fn(async () => {
          events?.push("limit");
          return {
            data,
            error,
          };
        }),
      };
    }),
  };

  return query;
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("returns filtered users with memberships and diocese admin flags", async () => {
    const parishId = "11111111-1111-4111-8111-111111111111";

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") {
          return {
            select: vi.fn(() =>
              createUserProfilesQuery({
                data: [
                  {
                    clerk_user_id: "alice",
                    email: "alice@example.com",
                    display_name: "Alice",
                    onboarding_completed_at: "2024-01-01",
                    created_at: "2024-01-01",
                  },
                ],
              }),
            ),
          };
        }

        if (table === "parish_memberships") {
          return {
            select: vi.fn(async () => ({
              data: [
                { parish_id: parishId, clerk_user_id: "alice", role: "parish_admin" },
                { parish_id: parishId, clerk_user_id: "bob", role: "student" },
              ],
              error: null,
            })),
          };
        }

        if (table === "diocese_admins") {
          return {
            select: vi.fn(async () => ({
              data: [{ clerk_user_id: "alice" }],
              error: null,
            })),
          };
        }

        if (table === "parishes") {
          return {
            select: vi.fn(async () => ({
              data: [{ id: parishId, name: "St Anne" }],
              error: null,
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await GET(
      new Request(
        `http://localhost/api/admin/users?q=alice&onboarding=yes&role=parish_admin&dioceseAdmin=yes&parishId=${parishId}`,
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          clerk_user_id: "alice",
          email: "alice@example.com",
          display_name: "Alice",
          onboarding_completed_at: "2024-01-01",
          created_at: "2024-01-01",
          is_diocese_admin: true,
          memberships: [{ parish_id: parishId, parish_name: "St Anne", role: "parish_admin" }],
        },
      ],
      parishes: [{ id: parishId, name: "St Anne" }],
    });
  });

  it("returns 400 for invalid parishId query param", async () => {
    const response = await GET(new Request("http://localhost/api/admin/users?parishId=not-a-uuid"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(String(body.error).toLowerCase()).toContain("uuid");
  });

  it("returns 400 when user listing fails", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") {
          return {
            select: vi.fn(() => createUserProfilesQuery({ data: [], error: { message: "users failed" } })),
          };
        }

        return {
          select: vi.fn(async () => ({ data: [], error: null })),
        };
      }),
    } as never);

    const response = await GET(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "users failed" });
  });

  it("applies membership filters before limiting user profiles", async () => {
    const parishId = "11111111-1111-4111-8111-111111111111";
    const inCalls: Array<{ column: string; values: string[] }> = [];

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") {
          return {
            select: vi.fn(() =>
              createUserProfilesQuery({
                data: [
                  {
                    clerk_user_id: "late-match",
                    email: "late@example.com",
                    display_name: "Late Match",
                    onboarding_completed_at: null,
                    created_at: "2024-01-03",
                  },
                ],
                onIn: (column, values) => inCalls.push({ column, values }),
              }),
            ),
          };
        }

        if (table === "parish_memberships") {
          return {
            select: vi.fn(async () => ({
              data: [
                { parish_id: "other-parish", clerk_user_id: "newest-user", role: "student" },
                { parish_id: parishId, clerk_user_id: "late-match", role: "instructor" },
              ],
              error: null,
            })),
          };
        }

        if (table === "diocese_admins") {
          return { select: vi.fn(async () => ({ data: [], error: null })) };
        }

        if (table === "parishes") {
          return { select: vi.fn(async () => ({ data: [{ id: parishId, name: "St Anne" }], error: null })) };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await GET(
      new Request(`http://localhost/api/admin/users?parishId=${parishId}&role=instructor&limit=1`),
    );

    expect(response.status).toBe(200);
    expect(inCalls).toEqual([{ column: "clerk_user_id", values: ["late-match"] }]);
    await expect(response.json()).resolves.toMatchObject({
      users: [{ clerk_user_id: "late-match" }],
    });
  });

  it("applies search and onboarding filters before limiting user profiles", async () => {
    const events: string[] = [];

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "user_profiles") {
          return {
            select: vi.fn(() =>
              createUserProfilesQuery({
                data: [
                  {
                    clerk_user_id: "target-user",
                    email: "target@example.com",
                    display_name: "Target User",
                    onboarding_completed_at: null,
                    created_at: "2024-01-01",
                  },
                ],
                events,
              }),
            ),
          };
        }

        if (table === "diocese_admins") {
          return { select: vi.fn(async () => ({ data: [], error: null })) };
        }

        return {
          select: vi.fn(async () => ({ data: [], error: null })),
        };
      }),
    } as never);

    const response = await GET(
      new Request("http://localhost/api/admin/users?q=target@example.com&onboarding=no&limit=1"),
    );

    expect(response.status).toBe(200);
    expect(events).toEqual(["or", "is", "order", "limit"]);
    await expect(response.json()).resolves.toMatchObject({
      users: [{ clerk_user_id: "target-user" }],
    });
  });
});
