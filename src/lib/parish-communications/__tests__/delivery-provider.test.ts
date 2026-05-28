import { afterEach, describe, expect, it } from "vitest";

import { deliverParishMessage, getParishDeliveryConfig } from "@/lib/parish-communications/delivery-provider";

describe("getParishDeliveryConfig", () => {
  afterEach(() => {
    delete process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE;
  });

  it("returns disabled mode by default", () => {
    expect(getParishDeliveryConfig()).toEqual({
      enabled: false,
      provider: null,
    });
  });

  it("enables the mock provider when configured", () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "MoCk";

    expect(getParishDeliveryConfig()).toEqual({
      enabled: true,
      provider: "mock",
    });
  });

  it("enables resend when configured with all env vars", () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "parish@test.com";

    expect(getParishDeliveryConfig()).toEqual({
      enabled: true,
      provider: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "parish@test.com",
    });

    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("falls back to disabled when resend is configured but missing api key", () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "resend";
    process.env.RESEND_FROM_EMAIL = "parish@test.com";

    expect(getParishDeliveryConfig()).toEqual({
      enabled: false,
      provider: null,
    });

    delete process.env.RESEND_FROM_EMAIL;
  });

  it("falls back to disabled when resend is configured but missing from email", () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "resend";
    process.env.RESEND_API_KEY = "re_test_key";

    expect(getParishDeliveryConfig()).toEqual({
      enabled: false,
      provider: null,
    });

    delete process.env.RESEND_API_KEY;
  });

  it("returns disabled for unknown delivery mode", () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "smtp";

    expect(getParishDeliveryConfig()).toEqual({
      enabled: false,
      provider: null,
    });
  });

  it("returns disabled when mode is explicitly set to disabled", () => {
    process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE = "disabled";

    expect(getParishDeliveryConfig()).toEqual({
      enabled: false,
      provider: null,
    });
  });
});

describe("deliverParishMessage", () => {
  it("throws for unsupported providers", async () => {
    await expect(
      deliverParishMessage({
        provider: "smtp" as never,
        subject: "Subject",
        body: "Body",
        recipients: [],
      }),
    ).rejects.toThrow("Unsupported parish delivery provider: smtp");
  });

  it("marks recipients with missing emails as failed", async () => {
    const result = await deliverParishMessage({
      provider: "mock",
      subject: "Subject",
      body: "Body",
      recipients: [
        { clerkUserId: "u-1", email: "u1@example.com" },
        { clerkUserId: "u-2", email: null },
      ],
    });

    expect(result).toEqual({
      sent: ["u-1"],
      failed: [{ clerkUserId: "u-2", error: "Recipient has no email on file." }],
    });
  });

  it("sends to all recipients when all have valid emails", async () => {
    const result = await deliverParishMessage({
      provider: "mock",
      subject: "Subject",
      body: "Body",
      recipients: [
        { clerkUserId: "u-1", email: "u1@example.com" },
        { clerkUserId: "u-2", email: "u2@example.com" },
      ],
    });

    expect(result).toEqual({
      sent: ["u-1", "u-2"],
      failed: [],
    });
  });

  it("returns empty sent and failed when recipients array is empty", async () => {
    const result = await deliverParishMessage({
      provider: "mock",
      subject: "Subject",
      body: "Body",
      recipients: [],
    });

    expect(result).toEqual({
      sent: [],
      failed: [],
    });
  });
});
