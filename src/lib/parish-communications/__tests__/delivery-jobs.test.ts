import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/parish-communications/delivery-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/parish-communications/delivery-provider")>(
    "@/lib/parish-communications/delivery-provider",
  );
  return {
    ...actual,
    deliverParishMessage: vi.fn(),
  };
});

import {
  enqueueParishMessageDeliveryJob,
  processParishMessageDeliveryJobBySendId,
  processPendingParishMessageDeliveryJobs,
} from "@/lib/parish-communications/delivery-jobs";
import { deliverParishMessage } from "@/lib/parish-communications/delivery-provider";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

class InMemorySupabase {
  tables: TableData;
  private readonly updateFailures: Record<string, Error[]>;

  constructor(seed: TableData, updateFailures: Record<string, Error[]> = {}) {
    this.tables = Object.fromEntries(
      Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
    );
    this.updateFailures = updateFailures;
  }

  from(table: string) {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return new InMemoryQuery(
      this.tables[table],
      () => this.updateFailures[table]?.shift() ?? null,
    );
  }
}

class InMemoryQuery implements PromiseLike<{ data: unknown; error: Error | null }> {
  private mode: "select" | "update" | null = null;
  private selectColumns: string[] | null = null;
  private updatePayload: Row = {};
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private shouldReturnSingle = false;

  constructor(
    private readonly rows: Row[],
    private readonly takeUpdateFailure: () => Error | null = () => null,
  ) {}

  select(columns: string) {
    if (!this.mode) {
      this.mode = "select";
    }
    this.selectColumns = columns.split(",").map((column) => column.trim());
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.updatePayload = payload;
    return this;
  }

  async insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload];
    this.rows.push(...rows.map((row) => ({ ...row })));
    return { data: null, error: null };
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => String(row[column] ?? "") <= String(value));
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => String(row[column] ?? "") < String(value));
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orderBy = { column, ascending: options.ascending };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.shouldReturnSingle = true;
    return this;
  }

  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute() {
    if (this.mode === "update") {
      const updateFailure = this.takeUpdateFailure();
      if (updateFailure) {
        return { data: null, error: updateFailure };
      }

      const matched = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
      for (const row of matched) {
        Object.assign(row, this.updatePayload);
      }
      const selected = this.projectRows(matched);
      return {
        data: this.shouldReturnSingle ? (selected[0] ?? null) : selected,
        error: null,
      };
    }

    const matched = this.rows.filter((row) => this.filters.every((filter) => filter(row))).map((row) => ({ ...row }));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      matched.sort((left, right) => {
        const leftValue = left[column];
        const rightValue = right[column];
        if (leftValue === rightValue) return 0;
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;
        return leftValue < rightValue ? (ascending ? -1 : 1) : ascending ? 1 : -1;
      });
    }
    const limited = this.limitCount == null ? matched : matched.slice(0, this.limitCount);
    const selected = this.projectRows(limited);
    return {
      data: this.shouldReturnSingle ? (selected[0] ?? null) : selected,
      error: null,
    };
  }

  private projectRows(rows: Row[]) {
    if (!this.selectColumns) {
      return rows.map((row) => ({ ...row }));
    }

    return rows.map((row) => {
      const projected: Row = {};
      for (const column of this.selectColumns ?? []) {
        projected[column] = row[column];
      }
      return projected;
    });
  }
}

function emptyStaleProcessingQuery() {
  const limit = vi.fn(async () => ({ data: [], error: null }));
  const order = vi.fn(() => ({ limit }));
  const lt = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ lt }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

describe("enqueueParishMessageDeliveryJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a pending job", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    await enqueueParishMessageDeliveryJob({
      parishId: "parish-1",
      sendId: "send-1",
      provider: "mock",
    });

    expect(supabase.tables.parish_message_delivery_jobs).toHaveLength(1);
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      parish_id: "parish-1",
      send_id: "send-1",
      provider: "mock",
      status: "pending",
      attempts: 0,
      max_attempts: 5,
    });
    expect(typeof supabase.tables.parish_message_delivery_jobs[0].next_attempt_at).toBe("string");
  });

  it("throws when insert fails", async () => {
    const insert = vi.fn(async () => ({ error: new Error("insert failed") }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);

    await expect(
      enqueueParishMessageDeliveryJob({
        parishId: "parish-1",
        sendId: "send-1",
        provider: "mock",
      }),
    ).rejects.toThrow("insert failed");
  });
});

describe("processParishMessageDeliveryJobBySendId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when no pending job matches", async () => {
    const supabase = new InMemorySupabase({ parish_message_delivery_jobs: [] });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    await expect(
      processParishMessageDeliveryJobBySendId({ sendId: "missing-send" }),
    ).resolves.toBe("not_found");
  });

  it.each(["admin@example.com", null, undefined])(
    "renders immediate sends with the saved admin's reply address: %s",
    async (adminEmail) => {
      const supabase = new InMemorySupabase({
        parish_message_delivery_jobs: [
          {
            id: "job-direct",
            send_id: "send-direct",
            parish_id: "parish-1",
            provider: "mock",
            status: "pending",
            attempts: 0,
            max_attempts: 5,
            next_attempt_at: "2000-01-01T00:00:00.000Z",
          },
        ],
        parish_message_sends: [
          { id: "send-direct", subject: "Subject", body: "Body", delivery_status: "queued", created_by_clerk_user_id: "admin-1" },
        ],
        parish_message_recipients: [
          { send_id: "send-direct", clerk_user_id: "u-1", delivery_status: "pending" },
        ],
        user_profiles: [
          { clerk_user_id: "u-1", email: "u1@example.com" },
          ...(adminEmail === undefined ? [] : [{ clerk_user_id: "admin-1", email: adminEmail }]),
        ],
      });
      vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
      vi.mocked(deliverParishMessage).mockResolvedValue({
        sent: [{ clerkUserId: "u-1", providerMessageId: null }],
        failed: [],
      });

      await expect(
        processParishMessageDeliveryJobBySendId({ sendId: "send-direct" }),
      ).resolves.toBe("sent");
      expect(supabase.tables.parish_message_delivery_jobs[0].status).toBe("sent");
      const request = vi.mocked(deliverParishMessage).mock.calls[0][0];
      expect(request).toMatchObject({
        subject: "Subject",
        body: expect.stringContaining("St. John Learning"),
        html: expect.stringContaining('id="email-card"'),
        recipients: [{ clerkUserId: "u-1", email: "u1@example.com" }],
      });
      expect(request.body).toContain("Body");
      if (adminEmail) {
        expect(request.replyTo).toBe(adminEmail);
      } else {
        expect(request).not.toHaveProperty("replyTo");
      }
    },
  );
});

describe("processPendingParishMessageDeliveryJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero summary when there are no pending jobs", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    await expect(processPendingParishMessageDeliveryJobs({ limit: 0 })).resolves.toEqual({
      processed: 0,
      sent: 0,
      failed: 0,
      requeued: 0,
    });
    await expect(processPendingParishMessageDeliveryJobs({ limit: 999 })).resolves.toEqual({
      processed: 0,
      sent: 0,
      failed: 0,
      requeued: 0,
    });
  });

  it("fails stale processing jobs without retrying or sending duplicates", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-stale",
          send_id: "send-stale",
          parish_id: "parish-1",
          provider: "resend",
          status: "processing",
          attempts: 0,
          max_attempts: 5,
          locked_at: "2000-01-01T00:00:00.000Z",
          created_at: "2000-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        { id: "send-stale", delivery_status: "queued" },
      ],
      parish_message_recipients: [
        {
          send_id: "send-stale",
          clerk_user_id: "u-1",
          delivery_status: "pending",
        },
      ],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(deliverParishMessage).not.toHaveBeenCalled();
    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("failed");
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      locked_at: null,
      locked_by: null,
    });
    expect(supabase.tables.parish_message_recipients[0]).toMatchObject({
      delivery_status: "failed",
      delivery_error: expect.stringContaining("avoid duplicate email"),
    });
  });

  it("returns requeued when a claim race loses ownership", async () => {
    const listLimit = vi.fn(async () => ({
      data: [
        {
          id: "job-1",
          send_id: "send-1",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 0,
          max_attempts: 5,
        },
      ],
      error: null,
    }));
    const listOrder = vi.fn(() => ({ limit: listLimit }));
    const listLte = vi.fn(() => ({ order: listOrder }));
    const listEq = vi.fn(() => ({ lte: listLte }));
    const listSelect = vi.fn(() => ({ eq: listEq }));

    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const claimSelect = vi.fn(() => ({ maybeSingle }));
    const claimEqStatus = vi.fn(() => ({ select: claimSelect }));
    const claimEqId = vi.fn(() => ({ eq: claimEqStatus }));
    const claimUpdate = vi.fn(() => ({ eq: claimEqId }));

    const from = vi
      .fn()
      .mockImplementationOnce(() => emptyStaleProcessingQuery())
      .mockImplementationOnce(() => ({ select: listSelect }))
      .mockImplementationOnce(() => ({ update: claimUpdate }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 0,
      requeued: 1,
    });
  });

  it("marks a job as sent when delivery succeeds for all recipients", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-1",
          send_id: "send-1",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        {
          id: "send-1",
          subject: "Subject",
          body: "Body",
          created_by_clerk_user_id: "admin-1",
          delivery_status: "queued",
        },
      ],
      parish_message_recipients: [
        {
          send_id: "send-1",
          clerk_user_id: "u-1",
          delivery_status: "pending",
        },
        {
          send_id: "send-1",
          clerk_user_id: "u-2",
          delivery_status: "pending",
        },
      ],
      user_profiles: [
        { clerk_user_id: "admin-1", email: "admin@example.com" },
        { clerk_user_id: "u-1", email: "u1@example.com" },
        { clerk_user_id: "u-2", email: "u2@example.com" },
      ],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockResolvedValue({
      sent: [
        { clerkUserId: "u-1", providerMessageId: "resend-1" },
        { clerkUserId: "u-2", providerMessageId: "resend-2" },
      ],
      failed: [],
    });

    await expect(processPendingParishMessageDeliveryJobs({ limit: 5 })).resolves.toEqual({
      processed: 1,
      sent: 1,
      failed: 0,
      requeued: 0,
    });

    expect(vi.mocked(deliverParishMessage)).toHaveBeenCalledWith({
      provider: "mock",
      replyTo: "admin@example.com",
      subject: "Subject",
      body: expect.stringContaining("Body"),
      html: expect.stringContaining("St. John Learning"),
      recipients: [
        { clerkUserId: "u-1", email: "u1@example.com" },
        { clerkUserId: "u-2", email: "u2@example.com" },
      ],
      idempotencyKey: "parish-message/send-1",
    });

    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("sent");
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "sent",
      attempts: 1,
      last_error: null,
      locked_at: null,
      locked_by: null,
    });
    expect(supabase.tables.parish_message_recipients).toEqual([
      expect.objectContaining({
        clerk_user_id: "u-1",
        delivery_status: "sent",
        provider_message_id: "resend-1",
        delivery_error: null,
      }),
      expect.objectContaining({
        clerk_user_id: "u-2",
        delivery_status: "sent",
        provider_message_id: "resend-2",
        delivery_error: null,
      }),
    ]);
  });

  it("fails closed when provider acceptance cannot be persisted", async () => {
    const supabase = new InMemorySupabase(
      {
        parish_message_delivery_jobs: [
          {
            id: "job-persistence-failure",
            send_id: "send-persistence-failure",
            parish_id: "parish-1",
            provider: "resend",
            status: "pending",
            attempts: 0,
            max_attempts: 5,
            next_attempt_at: "2000-01-01T00:00:00.000Z",
            created_at: "2000-01-01T00:00:00.000Z",
          },
        ],
        parish_message_sends: [
          {
            id: "send-persistence-failure",
            subject: "Subject",
            body: "Body",
            delivery_status: "queued",
          },
        ],
        parish_message_recipients: [
          {
            send_id: "send-persistence-failure",
            clerk_user_id: "u-1",
            delivery_status: "pending",
          },
        ],
        user_profiles: [{ clerk_user_id: "u-1", email: "u1@example.com" }],
      },
      { parish_message_recipients: [new Error("persistence failed")] },
    );
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockResolvedValue({
      sent: [{ clerkUserId: "u-1", providerMessageId: "resend-1" }],
      failed: [],
    });

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("failed");
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: expect.stringContaining("avoid duplicate email"),
    });
    expect(supabase.tables.parish_message_recipients[0]).toMatchObject({
      delivery_status: "failed",
      delivery_error: expect.stringContaining("avoid duplicate email"),
    });
  });

  it("marks a job as sent immediately when no recipients remain pending", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-empty",
          send_id: "send-empty",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        {
          id: "send-empty",
          subject: "Subject",
          body: "Body",
          delivery_status: "queued",
        },
      ],
      parish_message_recipients: [],
      user_profiles: [],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 1,
      failed: 0,
      requeued: 0,
    });

    expect(vi.mocked(deliverParishMessage)).not.toHaveBeenCalled();
    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("sent");
    expect(supabase.tables.parish_message_delivery_jobs[0].status).toBe("sent");
  });

  it("fails a job without automatic retry when delivery has recipient failures", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-2",
          send_id: "send-2",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 1,
          max_attempts: 5,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        {
          id: "send-2",
          subject: "Subject",
          body: "Body",
          delivery_status: "queued",
        },
      ],
      parish_message_recipients: [
        {
          send_id: "send-2",
          clerk_user_id: "u-1",
          delivery_status: "pending",
        },
        {
          send_id: "send-2",
          clerk_user_id: "u-2",
          delivery_status: "pending",
        },
      ],
      user_profiles: [
        { clerk_user_id: "u-1", email: "u1@example.com" },
        { clerk_user_id: "u-2", email: null },
      ],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockResolvedValue({
      sent: [{ clerkUserId: "u-1", providerMessageId: "resend-1" }],
      failed: [
        { clerkUserId: "u-2", error: "Mailbox unavailable" },
        { clerkUserId: "u-2", error: "Mailbox unavailable" },
      ],
    });

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("failed");
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 2,
      last_error: "Mailbox unavailable",
      locked_at: null,
      locked_by: null,
    });
    expect(supabase.tables.parish_message_recipients).toEqual([
      expect.objectContaining({
        clerk_user_id: "u-1",
        delivery_status: "sent",
        provider_message_id: "resend-1",
      }),
      expect.objectContaining({
        clerk_user_id: "u-2",
        delivery_status: "failed",
        delivery_error: "Mailbox unavailable",
      }),
    ]);
  });

  it("marks the job as failed when recipient failures hit max attempts", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-terminal-failure",
          send_id: "send-terminal-failure",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 4,
          max_attempts: 5,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        {
          id: "send-terminal-failure",
          subject: "Subject",
          body: "Body",
          delivery_status: "queued",
        },
      ],
      parish_message_recipients: [
        {
          send_id: "send-terminal-failure",
          clerk_user_id: "u-1",
          delivery_status: "pending",
        },
      ],
      user_profiles: [{ clerk_user_id: "u-1", email: "u1@example.com" }],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockResolvedValue({
      sent: [],
      failed: [{ clerkUserId: "u-1", error: "Mailbox unavailable" }],
    });

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("failed");
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 5,
      last_error: "Mailbox unavailable",
    });
  });

  it("marks the job as failed when the send record no longer exists and retries are exhausted", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-3",
          send_id: "send-missing",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 0,
          max_attempts: 1,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [],
      parish_message_recipients: [],
      user_profiles: [],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: "Message send record is missing.",
    });
  });

  it("fails closed with a generic interrupted-delivery message for unknown provider errors", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-4",
          send_id: "send-4",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 4,
          max_attempts: 5,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        {
          id: "send-4",
          subject: "Subject",
          body: "Body",
        },
      ],
      parish_message_recipients: [
        {
          send_id: "send-4",
          clerk_user_id: "u-1",
          delivery_status: "pending",
        },
      ],
      user_profiles: [{ clerk_user_id: "u-1", email: "u1@example.com" }],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockRejectedValue("provider down");

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 5,
      last_error: expect.stringContaining("avoid duplicate email"),
    });
  });

  it("fails closed when the provider throws after dispatch begins", async () => {
    const supabase = new InMemorySupabase({
      parish_message_delivery_jobs: [
        {
          id: "job-error",
          send_id: "send-error",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 0,
          max_attempts: 3,
          next_attempt_at: "2000-01-01T00:00:00.000Z",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      parish_message_sends: [
        {
          id: "send-error",
          subject: "Subject",
          body: "Body",
        },
      ],
      parish_message_recipients: [
        {
          send_id: "send-error",
          clerk_user_id: "u-1",
          delivery_status: "pending",
        },
      ],
      user_profiles: [{ clerk_user_id: "u-1", email: "u1@example.com" }],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockRejectedValue(new Error("provider unavailable"));

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 1,
      requeued: 0,
    });

    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      last_error: expect.stringContaining("avoid duplicate email"),
    });
  });

  it("throws when claiming a listed pending job fails", async () => {
    const listLimit = vi.fn(async () => ({
      data: [
        {
          id: "job-claim-fail",
          send_id: "send-claim-fail",
          parish_id: "parish-1",
          provider: "mock",
          status: "pending",
          attempts: 0,
          max_attempts: 5,
        },
      ],
      error: null,
    }));
    const listOrder = vi.fn(() => ({ limit: listLimit }));
    const listLte = vi.fn(() => ({ order: listOrder }));
    const listEq = vi.fn(() => ({ lte: listLte }));
    const listSelect = vi.fn(() => ({ eq: listEq }));

    const maybeSingle = vi.fn(async () => ({ data: null, error: new Error("claim failed") }));
    const claimSelect = vi.fn(() => ({ maybeSingle }));
    const claimEqStatus = vi.fn(() => ({ select: claimSelect }));
    const claimEqId = vi.fn(() => ({ eq: claimEqStatus }));
    const claimUpdate = vi.fn(() => ({ eq: claimEqId }));

    const from = vi
      .fn()
      .mockImplementationOnce(() => emptyStaleProcessingQuery())
      .mockImplementationOnce(() => ({ select: listSelect }))
      .mockImplementationOnce(() => ({ update: claimUpdate }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(processPendingParishMessageDeliveryJobs()).rejects.toThrow("claim failed");
  });

  it("throws when reading pending jobs fails", async () => {
    const limit = vi.fn(async () => ({ data: null, error: new Error("query failed") }));
    const order = vi.fn(() => ({ limit }));
    const lte = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ lte }));
    const select = vi.fn(() => ({ eq }));

    const from = vi
      .fn()
      .mockImplementationOnce(() => emptyStaleProcessingQuery())
      .mockImplementationOnce(() => ({ select }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);

    await expect(processPendingParishMessageDeliveryJobs()).rejects.toThrow("query failed");
  });
});
