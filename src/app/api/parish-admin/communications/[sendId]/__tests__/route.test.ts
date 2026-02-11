import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz", () => ({ requireParishRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));

import { GET } from "@/app/api/parish-admin/communications/[sendId]/route";
import { requireParishRole } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("/api/parish-admin/communications/[sendId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireParishRole).mockResolvedValue({
      clerkUserId: "admin-1",
      parishId: "11111111-1111-4111-8111-111111111111",
      role: "parish_admin",
    });
  });

  it("returns send details with recipient summary", async () => {
    const sendMaybeSingle = vi.fn(async () => ({
      data: {
        id: "22222222-2222-4222-8222-222222222222",
        subject: "Reminder",
        body: "Please continue.",
        delivery_status: "queued",
        recipient_count: 2,
        created_at: "2026-02-11T00:00:00.000Z",
      },
      error: null,
    }));
    const sendEqParish = vi.fn(() => ({ maybeSingle: sendMaybeSingle }));
    const sendEqId = vi.fn(() => ({ eq: sendEqParish }));
    const sendSelect = vi.fn(() => ({ eq: sendEqId }));

    const recipientLimit = vi.fn(async () => ({
      data: [
        {
          clerk_user_id: "user-1",
          delivery_status: "sent",
          delivery_attempted_at: "2026-02-11T10:00:00.000Z",
          delivery_error: null,
        },
        {
          clerk_user_id: "user-2",
          delivery_status: "failed",
          delivery_attempted_at: "2026-02-11T10:00:00.000Z",
          delivery_error: "Mailbox not found.",
        },
      ],
      error: null,
    }));
    const recipientOrder = vi.fn(() => ({ limit: recipientLimit }));
    const recipientEqParish = vi.fn(() => ({ order: recipientOrder }));
    const recipientEqSend = vi.fn(() => ({ eq: recipientEqParish }));
    const recipientSelect = vi.fn(() => ({ eq: recipientEqSend }));

    const profilesIn = vi.fn(async () => ({
      data: [
        { clerk_user_id: "user-1", email: "u1@example.com", display_name: "User One" },
        { clerk_user_id: "user-2", email: "u2@example.com", display_name: null },
      ],
      error: null,
    }));
    const profileSelect = vi.fn(() => ({ in: profilesIn }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_message_sends") return { select: sendSelect };
        if (table === "parish_message_recipients") return { select: recipientSelect };
        if (table === "user_profiles") return { select: profileSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sendId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.summary).toEqual({
      total: 2,
      not_configured: 0,
      pending: 0,
      sent: 1,
      failed: 1,
    });
    expect(json.recipients).toHaveLength(2);
  });

  it("returns 404 when send is not found", async () => {
    const sendMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const sendEqParish = vi.fn(() => ({ maybeSingle: sendMaybeSingle }));
    const sendEqId = vi.fn(() => ({ eq: sendEqParish }));
    const sendSelect = vi.fn(() => ({ eq: sendEqId }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parish_message_sends") return { select: sendSelect };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ sendId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Message send not found." });
  });
});
