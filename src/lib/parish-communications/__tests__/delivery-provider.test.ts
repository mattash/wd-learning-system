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
});
