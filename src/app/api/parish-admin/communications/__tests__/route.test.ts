import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET, POST } from "@/app/api/parish-admin/communications/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/communications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE;
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("lists message sends", async () => {
    const limit = vi.fn(async () => ({ data: [{ id: "send-1" }], error: null }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sends: [{ id: "send-1" }] });
  });

  it("logs a message for all members", async () => {
    const membershipEq = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }, { clerk_user_id: "user-2" }],
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    const sendSingle = vi.fn(async () => ({ data: { id: "send-1", recipient_count: 2 }, error: null }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));

    const recipientInsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "parish_message_sends") return { insert: sendInsert };
        if (table === "parish_message_recipients") return { insert: recipientInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Please continue your course this week.",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.send.id).toBe("send-1");
    expect(String(json.deliveryNote)).toContain("not configured");
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when audience resolves to no recipients", async () => {
    const membershipEq = vi.fn(async () => ({ data: [], error: null }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "parish_message_sends") return { insert: vi.fn() };
        if (table === "parish_message_recipients") return { insert: vi.fn() };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Reminder",
          body: "Please continue your course this week.",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No recipients match this audience." });
  });

  it("queues a delivery job when async delivery mode is enabled", async () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "mock";

    const membershipEq = vi.fn(async () => ({
      data: [{ clerk_user_id: "user-1" }],
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    const sendSingle = vi.fn(async () => ({ data: { id: "send-2", recipient_count: 1 }, error: null }));
    const sendSelect = vi.fn(() => ({ single: sendSingle }));
    const sendInsert = vi.fn(() => ({ select: sendSelect }));

    const recipientInsert = vi.fn(async () => ({ error: null }));
    const jobInsert = vi.fn(async () => ({ error: null }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        if (table === "parish_message_sends") return { insert: sendInsert };
        if (table === "parish_message_recipients") return { insert: recipientInsert };
        if (table === "parish_message_delivery_jobs") return { insert: jobInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Queued reminder",
          body: "This should queue.",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(String(json.deliveryNote)).toContain("queued");
    expect(jobInsert).toHaveBeenCalledTimes(1);
  });
});
