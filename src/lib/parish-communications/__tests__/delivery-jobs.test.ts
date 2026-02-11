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
  processPendingParishMessageDeliveryJobs,
} from "@/lib/parish-communications/delivery-jobs";
import { deliverParishMessage } from "@/lib/parish-communications/delivery-provider";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

class InMemorySupabase {
  tables: TableData;

  constructor(seed: TableData) {
    this.tables = Object.fromEntries(
      Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
    );
  }

  from(table: string) {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return new InMemoryQuery(this.tables[table]);
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

  constructor(private readonly rows: Row[]) {}

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
        { clerk_user_id: "u-1", email: "u1@example.com" },
        { clerk_user_id: "u-2", email: "u2@example.com" },
      ],
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue(supabase as never);
    vi.mocked(deliverParishMessage).mockResolvedValue({
      sent: ["u-1", "u-2"],
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
      subject: "Subject",
      body: "Body",
      recipients: [
        { clerkUserId: "u-1", email: "u1@example.com" },
        { clerkUserId: "u-2", email: "u2@example.com" },
      ],
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
        delivery_error: null,
      }),
      expect.objectContaining({
        clerk_user_id: "u-2",
        delivery_status: "sent",
        delivery_error: null,
      }),
    ]);
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

  it("requeues a job when delivery has recipient failures", async () => {
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
      sent: ["u-1"],
      failed: [
        { clerkUserId: "u-2", error: "Mailbox unavailable" },
        { clerkUserId: "u-2", error: "Mailbox unavailable" },
      ],
    });

    await expect(processPendingParishMessageDeliveryJobs()).resolves.toEqual({
      processed: 1,
      sent: 0,
      failed: 0,
      requeued: 1,
    });

    expect(supabase.tables.parish_message_sends[0].delivery_status).toBe("queued");
    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "pending",
      attempts: 2,
      last_error: "Mailbox unavailable",
      locked_at: null,
      locked_by: null,
    });
    expect(supabase.tables.parish_message_recipients).toEqual([
      expect.objectContaining({
        clerk_user_id: "u-1",
        delivery_status: "sent",
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

  it("uses a generic retry message for unknown thrown values", async () => {
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
      last_error: "Unknown delivery error.",
    });
  });

  it("uses the thrown error message when the provider throws an Error", async () => {
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
      failed: 0,
      requeued: 1,
    });

    expect(supabase.tables.parish_message_delivery_jobs[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      last_error: "provider unavailable",
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

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    await expect(processPendingParishMessageDeliveryJobs()).rejects.toThrow("query failed");
  });
});
