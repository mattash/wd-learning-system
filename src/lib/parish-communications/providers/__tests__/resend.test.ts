import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmailViaResend } from "@/lib/parish-communications/providers/resend";

global.fetch = vi.fn();

function mockFetch(response: unknown, ok = true) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
    text: async () => "server error",
  } as never);
}

describe("sendEmailViaResend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseRequest = {
    provider: "resend" as const,
    subject: "Test Subject",
    body: "Test body",
    recipients: [
      { clerkUserId: "u-1", email: "user1@example.com" },
      { clerkUserId: "u-2", email: "user2@example.com" },
    ],
  };

  it("sends to all recipients when Resend returns all IDs", async () => {
    mockFetch({ data: [{ id: "resend-id-1" }, { id: "resend-id-2" }] });
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      baseRequest,
    );
    expect(result.sent).toEqual([
      { clerkUserId: "u-1", providerMessageId: "resend-id-1" },
      { clerkUserId: "u-2", providerMessageId: "resend-id-2" },
    ]);
    expect(result.failed).toHaveLength(0);
  });

  it("marks recipients as failed when response has no data array", async () => {
    mockFetch({});
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      baseRequest,
    );
    expect(result.sent).toHaveLength(0);
    expect(result.failed).toEqual([
      { clerkUserId: "u-1", error: "Resend batch response missing email ids" },
      { clerkUserId: "u-2", error: "Resend batch response missing email ids" },
    ]);
  });

  it("marks recipients as failed when response IDs count does not match batch size", async () => {
    mockFetch({ data: [{ id: "only-one" }] });
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      baseRequest,
    );
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBe("Resend batch response missing email ids");
  });

  it("marks recipients as failed when some IDs are missing", async () => {
    mockFetch({ data: [{ id: "id-1" }, null] });
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      baseRequest,
    );
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBe("Resend batch response missing email ids");
  });

  it("marks recipients as failed when Resend API returns non-ok status", async () => {
    mockFetch({ message: "Invalid API key" }, false);
    const result = await sendEmailViaResend(
      { apiKey: "bad-key", fromEmail: "from@example.com" },
      baseRequest,
    );
    expect(result.sent).toHaveLength(0);
    expect(result.failed).toEqual([
      { clerkUserId: "u-1", error: "Resend API error 500: server error" },
      { clerkUserId: "u-2", error: "Resend API error 500: server error" },
    ]);
  });

  it("marks recipients with null emails as failed on network error", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Connection refused"));
    const mixedRequest = {
      ...baseRequest,
      recipients: [
        { clerkUserId: "u-1", email: "user1@example.com" },
        { clerkUserId: "u-2", email: null },
      ],
    };
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      mixedRequest,
    );
    expect(result.sent).toHaveLength(0);
    expect(result.failed).toEqual([
      { clerkUserId: "u-1", error: "Connection refused" },
      { clerkUserId: "u-2", error: "Recipient has no email on file." },
    ]);
  });

  it("marks recipients with null emails as failed on success response", async () => {
    mockFetch({ data: [{ id: "resend-id-1" }] });
    const mixedRequest = {
      ...baseRequest,
      recipients: [
        { clerkUserId: "u-1", email: "user1@example.com" },
        { clerkUserId: "u-2", email: null },
      ],
    };
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      mixedRequest,
    );
    expect(result.sent).toEqual([
      { clerkUserId: "u-1", providerMessageId: "resend-id-1" },
    ]);
    expect(result.failed).toEqual([
      { clerkUserId: "u-2", error: "Recipient has no email on file." },
    ]);
  });

  it("uses a stable idempotency key and recipient order for retries", async () => {
    mockFetch({ data: [{ id: "resend-id-1" }, { id: "resend-id-2" }] });

    await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      {
        ...baseRequest,
        idempotencyKey: "parish-message/send-1",
        recipients: [...baseRequest.recipients].reverse(),
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails/batch",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(/^parish-message\/send-1\/[a-f0-9]{32}$/),
        }),
        body: JSON.stringify([
          {
            from: "from@example.com",
            to: ["user1@example.com"],
            subject: "Test Subject",
            text: "Test body",
          },
          {
            from: "from@example.com",
            to: ["user2@example.com"],
            subject: "Test Subject",
            text: "Test body",
          },
        ]),
      }),
    );
  });

  it("handles batch split when recipients exceed 100", async () => {
    // First batch of 100, then second batch of 2
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ data: Array.from({ length: 100 }, (_, i) => ({ id: `id-${i}` })) }),
      } as never)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ data: Array.from({ length: 2 }, (_, i) => ({ id: `id-${100 + i}` })) }),
      } as never);

    const largeRequest = {
      ...baseRequest,
      recipients: Array.from({ length: 102 }, (_, i) => ({
        clerkUserId: `u-${i}`,
        email: `user${i}@example.com`,
      })),
    };

    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      largeRequest,
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.sent).toHaveLength(102);
    expect(result.failed).toHaveLength(0);
  });

  it("treats non-Error thrown values as 'Network error'", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce("string error" as never);
    const result = await sendEmailViaResend(
      { apiKey: "test-key", fromEmail: "from@example.com" },
      baseRequest,
    );
    expect(result.failed[0].error).toBe("Network error");
  });
});