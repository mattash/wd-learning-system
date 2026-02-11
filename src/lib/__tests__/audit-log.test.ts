import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { listAdminAuditLogs, recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("recordAdminAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an audit row and normalizes optional fields", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);

    await recordAdminAuditLog({
      actorClerkUserId: "admin-1",
      action: "parish.updated",
      resourceType: "parish",
    });

    expect(insert).toHaveBeenCalledWith({
      actor_clerk_user_id: "admin-1",
      action: "parish.updated",
      resource_type: "parish",
      resource_id: null,
      details: {},
    });
  });

  it("swallows insertion failures to avoid blocking admin actions", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => {
        throw new Error("write failed");
      }),
    } as never);

    await expect(
      recordAdminAuditLog({
        actorClerkUserId: "admin-1",
        action: "parish.updated",
        resourceType: "parish",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("listAdminAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data with default limit when no filters are passed", async () => {
    const queryResult = { data: [], error: null };
    const query = {
      eq: vi.fn(() => query),
      gte: vi.fn(() => query),
      lte: vi.fn(() => query),
      then: (resolve: (value: typeof queryResult) => unknown) => Promise.resolve(queryResult).then(resolve),
    };

    const limit = vi.fn(() => query);
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(listAdminAuditLogs()).resolves.toEqual([]);
    expect(limit).toHaveBeenCalledWith(100);
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.gte).not.toHaveBeenCalled();
    expect(query.lte).not.toHaveBeenCalled();
  });

  it("applies all optional filters to the query", async () => {
    const queryResult = {
      data: [{ id: "log-1", action: "parish.updated" }],
      error: null,
    };
    const query = {
      eq: vi.fn(() => query),
      gte: vi.fn(() => query),
      lte: vi.fn(() => query),
      then: (resolve: (value: typeof queryResult) => unknown) => Promise.resolve(queryResult).then(resolve),
    };

    const limit = vi.fn(() => query);
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(
      listAdminAuditLogs({
        action: "parish.updated",
        actorClerkUserId: "admin-1",
        resourceType: "parish",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        limit: 10,
      }),
    ).resolves.toEqual([{ id: "log-1", action: "parish.updated" }]);

    expect(limit).toHaveBeenCalledWith(10);
    expect(query.eq).toHaveBeenCalledWith("action", "parish.updated");
    expect(query.eq).toHaveBeenCalledWith("actor_clerk_user_id", "admin-1");
    expect(query.eq).toHaveBeenCalledWith("resource_type", "parish");
    expect(query.gte).toHaveBeenCalledWith("created_at", "2024-01-01T00:00:00.000Z");
    expect(query.lte).toHaveBeenCalledWith("created_at", "2024-01-31T23:59:59.999Z");
  });

  it("throws when the underlying query returns an error", async () => {
    const queryResult = { data: null, error: new Error("boom") };
    const query = {
      eq: vi.fn(() => query),
      gte: vi.fn(() => query),
      lte: vi.fn(() => query),
      then: (resolve: (value: typeof queryResult) => unknown) => Promise.resolve(queryResult).then(resolve),
    };

    const limit = vi.fn(() => query);
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(listAdminAuditLogs()).rejects.toThrow("boom");
  });
});
