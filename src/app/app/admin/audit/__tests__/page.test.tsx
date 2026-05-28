import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin-audit-log-viewer", () => ({
  AdminAuditLogViewer: ({ initialLogs }: { initialLogs: unknown[] }) => (
    <div>Audit logs: {initialLogs.length}</div>
  ),
}));

vi.mock("@/lib/authz", () => ({
  requireDioceseAdmin: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  listAdminAuditLogs: vi.fn(),
}));

import DioceseAdminAuditPage from "@/app/app/admin/audit/page";
import { listAdminAuditLogs } from "@/lib/audit-log";
import { requireDioceseAdmin } from "@/lib/authz";

describe("DioceseAdminAuditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireDioceseAdmin).mockResolvedValue("admin-1");
    vi.mocked(listAdminAuditLogs).mockResolvedValue([
      {
        id: "log-1",
        actor_clerk_user_id: "admin-1",
        action: "parish.updated",
        resource_type: "parish",
        resource_id: "parish-1",
        details: {},
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("requires a diocese admin before rendering audit logs", async () => {
    render(await DioceseAdminAuditPage());

    expect(requireDioceseAdmin).toHaveBeenCalledBefore(listAdminAuditLogs);
    expect(listAdminAuditLogs).toHaveBeenCalledWith({ limit: 100 });
    expect(screen.getByRole("heading", { name: "Audit Logs" })).toBeInTheDocument();
    expect(screen.getByText("Audit logs: 1")).toBeInTheDocument();
  });

  it("does not load audit logs when the guard rejects access", async () => {
    const accessError = new Error("redirect");
    vi.mocked(requireDioceseAdmin).mockRejectedValue(accessError);

    await expect(DioceseAdminAuditPage()).rejects.toThrow(accessError);
    expect(listAdminAuditLogs).not.toHaveBeenCalled();
  });
});
