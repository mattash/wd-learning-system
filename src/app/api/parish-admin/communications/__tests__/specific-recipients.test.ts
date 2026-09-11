import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/parish-communications/delivery-provider", () => ({ getParishDeliveryConfig: () => ({ enabled: false, provider: null }) }));
vi.mock("@/lib/parish-communications/delivery-jobs", () => ({
  enqueueParishMessageDeliveryJob: vi.fn(),
  processParishMessageDeliveryJobBySendId: vi.fn(),
}));

import { POST } from "@/app/api/parish-admin/communications/route";
import { requireParishRole } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { processParishMessageDeliveryJobBySendId } from "@/lib/parish-communications/delivery-jobs";

function request(recipientIds: unknown, extra = {}) {
  return new Request("http://localhost/api/parish-admin/communications", {
    method: "POST",
    body: JSON.stringify({ subject: "Reminder", body: "Continue learning", audienceType: "specific_recipients", recipientIds, ...extra }),
  });
}

function mockDatabase(ids: string[], error: { message: string } | null = null) {
  const inIds = vi.fn(async () => ({ data: ids.map((clerk_user_id) => ({ clerk_user_id })), error }));
  const eq = vi.fn(() => ({ in: inIds }));
  const sendInsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "send-1" }, error: null }) }) }));
  const recipientInsert = vi.fn<(rows: unknown) => Promise<{ error: null }>>().mockResolvedValue({ error: null });
  vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: vi.fn((table: string) => {
    if (table === "enrollments") return { select: () => ({ eq }) };
    if (table === "parish_message_sends") return { insert: sendInsert };
    if (table === "parish_message_recipients") return { insert: recipientInsert };
    throw new Error(`Unexpected table: ${table}`);
  }) } as never);
  return { eq, inIds, sendInsert, recipientInsert };
}

describe("specific recipient authorization and delivery payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({ clerkUserId: "admin-1", parishId: "parish-1", role: "parish_admin" });
  });

  it("checks enrollment in the authenticated parish and persists only deduplicated selected recipients", async () => {
    const db = mockDatabase(["alice", "alice", "bob"]);
    expect((await POST(request(["alice", "bob", "alice"], { parishId: "other-parish" }))).status).toBe(200);
    expect(requireParishRole).toHaveBeenCalledWith("parish_admin");
    expect(db.eq).toHaveBeenCalledWith("parish_id", "parish-1");
    expect(db.inIds).toHaveBeenCalledWith("clerk_user_id", ["alice", "bob"]);
    expect(db.sendInsert).toHaveBeenCalledWith(expect.objectContaining({ audience_type: "specific_recipients", recipient_count: 2 }));
    expect(db.recipientInsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ clerk_user_id: "alice", parish_id: "parish-1" }),
      expect.objectContaining({ clerk_user_id: "bob", parish_id: "parish-1" }),
    ]);
    expect(processParishMessageDeliveryJobBySendId).not.toHaveBeenCalled();
  });

  it.each(["foreign-parish-student", "unenrolled-member", "removed-enrollment"])("rejects the entire send for %s", async (invalidId) => {
    const db = mockDatabase(["alice"]);
    const response = await POST(request(["alice", invalidId]));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("must be enrolled in this parish");
    expect(db.sendInsert).not.toHaveBeenCalled();
    expect(db.recipientInsert).not.toHaveBeenCalled();
  });

  it.each([undefined, [], [""], [1], Array.from({ length: 101 }, (_, i) => `user-${i}`)])("rejects invalid selections (%j)", async (ids) => {
    expect((await POST(request(ids))).status).toBe(400);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects ambiguous course context on a specific selection", async () => {
    expect((await POST(request(["alice"], { audienceValue: "11111111-1111-4111-8111-111111111111" }))).status).toBe(400);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("fails closed when enrollment lookup fails", async () => {
    const db = mockDatabase([], { message: "Enrollment lookup failed" });
    expect((await POST(request(["alice"]))).status).toBe(400);
    expect(db.sendInsert).not.toHaveBeenCalled();
  });

  it("requires authorization before reading enrollments", async () => {
    vi.mocked(requireParishRole).mockRejectedValue(new Error("Forbidden"));
    await expect(POST(request(["alice"]))).rejects.toThrow("Forbidden");
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
