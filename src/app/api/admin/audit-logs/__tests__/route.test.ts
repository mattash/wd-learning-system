import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  listAdminAuditLogs: vi.fn(),
}));

import { GET } from "@/app/api/admin/audit-logs/route";
import { requireDioceseAdmin } from "@/lib/authz";
import { listAdminAuditLogs } from "@/lib/audit-log";

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
  });

  it("returns logs with parsed filters", async () => {
    vi.mocked(listAdminAuditLogs).mockResolvedValue([
      {
        id: "log-1",
        actor_clerk_user_id: "admin-1",
        action: "parish.updated",
        resource_type: "parish",
        resource_id: "p1",
        details: {},
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/audit-logs?action=parish.updated&actorUserId=admin-1&resourceType=parish&startDate=2024-01-01&endDate=2024-01-31&limit=25",
      ),
    );

    expect(response.status).toBe(200);
    expect(listAdminAuditLogs).toHaveBeenCalledWith({
      action: "parish.updated",
      actorClerkUserId: "admin-1",
      resourceType: "parish",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      limit: 25,
    });
    await expect(response.json()).resolves.toEqual({
      logs: [
        {
          id: "log-1",
          actor_clerk_user_id: "admin-1",
          action: "parish.updated",
          resource_type: "parish",
          resource_id: "p1",
          details: {},
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns 400 for invalid date ranges", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/audit-logs?startDate=2024-02-01&endDate=2024-01-01"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "startDate must be before or equal to endDate" });
  });

  it("returns 400 when listing fails", async () => {
    vi.mocked(listAdminAuditLogs).mockRejectedValue(new Error("boom"));
    const response = await GET(new Request("http://localhost/api/admin/audit-logs"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "boom" });
  });
});
