import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ recordAdminAuditLog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/parish-communications/delivery-jobs", () => ({
  enqueueParishMessageDeliveryJob: vi.fn(),
  processParishMessageDeliveryJobBySendId: vi.fn(),
}));

import { GET, POST } from "@/app/api/parish-admin/communications/route";
import { requireParishRole } from "@/lib/authz";
import { recordAdminAuditLog } from "@/lib/audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  enqueueParishMessageDeliveryJob,
  processParishMessageDeliveryJobBySendId,
} from "@/lib/parish-communications/delivery-jobs";

describe("/api/parish-admin/communications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE;
    vi.mocked(enqueueParishMessageDeliveryJob).mockResolvedValue();
    vi.mocked(processParishMessageDeliveryJobBySendId).mockResolvedValue("sent");
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

  it("records the authenticated sender and ignores client-supplied reply identity", async () => {
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
          created_by_clerk_user_id: "other-admin",
          replyTo: "spoof@example.com",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(sendInsert).toHaveBeenCalledWith(expect.objectContaining({
      created_by_clerk_user_id: "admin-1",
    }));
    expect(sendInsert).not.toHaveBeenCalledWith(expect.objectContaining({
      replyTo: expect.anything(),
    }));
    const json = await response.json();
    expect(json.send.id).toBe("send-1");
    expect(String(json.deliveryNote)).toContain("not configured");
    expect(recordAdminAuditLog).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid communication request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid request payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "",
          body: "Please continue your course this week.",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid communication request payload" });
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
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

  it("rejects audiences larger than one provider batch", async () => {
    const membershipEq = vi.fn(async () => ({
      data: Array.from({ length: 101 }, (_, index) => ({ clerk_user_id: `user-${index}` })),
      error: null,
    }));
    const membershipSelect = vi.fn(() => ({ eq: membershipEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_memberships") return { select: membershipSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/parish-admin/communications", {
        method: "POST",
        body: JSON.stringify({
          subject: "Large audience",
          body: "This should require segmentation.",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Audience exceeds the 100-recipient delivery limit.",
    });
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
          subject: "Queued reminder",
          body: "This should queue.",
          audienceType: "all_members",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.deliveryNote).toBe("Message sent.");
    expect(json.send.delivery_status).toBe("sent");
    expect(enqueueParishMessageDeliveryJob).toHaveBeenCalledTimes(1);
    expect(processParishMessageDeliveryJobBySendId).toHaveBeenCalledWith({ sendId: "send-2" });
  });
});
