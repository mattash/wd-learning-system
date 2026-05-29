import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/parish-communications/delivery-jobs", () => ({
  processPendingParishMessageDeliveryJobs: vi.fn(),
}));

import { POST } from "@/app/api/internal/parish-admin/communications/deliver/route";
import { processPendingParishMessageDeliveryJobs } from "@/lib/parish-communications/delivery-jobs";

describe("/api/internal/parish-admin/communications/deliver", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN;
  });

  it("returns 500 when worker token is not configured", async () => {
    const response = await POST(new Request("http://localhost/api/internal/parish-admin/communications/deliver", { method: "POST" }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "PARISH_COMMUNICATIONS_WORKER_TOKEN is not configured.",
    });
  });

  it("returns 401 when token is invalid", async () => {
    process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN = "expected-token";
    const response = await POST(
      new Request("http://localhost/api/internal/parish-admin/communications/deliver", {
        method: "POST",
        headers: {
          "x-parish-worker-token": "wrong-token",
        },
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("processes pending jobs with valid token", async () => {
    process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN = "expected-token";
    vi.mocked(processPendingParishMessageDeliveryJobs).mockResolvedValue({
      processed: 2,
      sent: 1,
      failed: 0,
      requeued: 1,
    });

    const response = await POST(
      new Request("http://localhost/api/internal/parish-admin/communications/deliver", {
        method: "POST",
        headers: {
          authorization: "Bearer expected-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 5 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(processPendingParishMessageDeliveryJobs).toHaveBeenCalledWith({ limit: 5 });
    await expect(response.json()).resolves.toEqual({
      processed: 2,
      sent: 1,
      failed: 0,
      requeued: 1,
    });
  });

  it("processes pending jobs with valid token and empty body", async () => {
    process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN = "expected-token";
    vi.mocked(processPendingParishMessageDeliveryJobs).mockResolvedValue({
      processed: 0,
      sent: 0,
      failed: 0,
      requeued: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/internal/parish-admin/communications/deliver", {
        method: "POST",
        headers: {
          "x-parish-worker-token": "expected-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(processPendingParishMessageDeliveryJobs).toHaveBeenCalledWith({ limit: undefined });
  });

  it("returns 400 for malformed JSON", async () => {
    process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN = "expected-token";

    const response = await POST(
      new Request("http://localhost/api/internal/parish-admin/communications/deliver", {
        method: "POST",
        headers: {
          "x-parish-worker-token": "expected-token",
          "content-type": "application/json",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid delivery request payload" });
    expect(processPendingParishMessageDeliveryJobs).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid limits", async () => {
    process.env.PARISH_COMMUNICATIONS_WORKER_TOKEN = "expected-token";

    const response = await POST(
      new Request("http://localhost/api/internal/parish-admin/communications/deliver", {
        method: "POST",
        headers: {
          "x-parish-worker-token": "expected-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 51 }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid delivery request payload" });
    expect(processPendingParishMessageDeliveryJobs).not.toHaveBeenCalled();
  });
});
