import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sendJoinRequestConfirmation } from "../send-join-request-confirmation";
import { buildTransactionalEmail } from "../build-transactional-email";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));
const params = {
  toEmail: "ani@example.com",
  displayName: "Ani",
  courseTitle: "Armenian Basics",
  parishName: "St. John",
};

beforeEach(() => {
  send.mockReset().mockResolvedValue({ error: null });
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "learning@example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://learning.example.com");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("sends branded HTML and required text with the original subject", async () => {
  await sendJoinRequestConfirmation(params);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    from: "learning@example.com",
    to: params.toEmail,
    ...(await buildTransactionalEmail("submitted", params)),
  });
});
it.each(["RESEND_API_KEY", "RESEND_FROM_EMAIL"])(
  "skips delivery without %s",
  async (key) => {
    vi.stubEnv(key, "");
    await sendJoinRequestConfirmation(params);
    expect(send).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  },
);
it("logs provider errors without throwing", async () => {
  send.mockResolvedValue({ error: { message: "provider failure" } });
  await expect(sendJoinRequestConfirmation(params)).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalled();
});
it.each([new Error("network failure"), "network failure"])(
  "logs thrown errors without throwing",
  async (error) => {
    send.mockRejectedValue(error);
    await expect(sendJoinRequestConfirmation(params)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  },
);
it("handles invalid URL configuration within the nonblocking boundary", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
  await expect(sendJoinRequestConfirmation(params)).resolves.toBeUndefined();
  expect(send).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalled();
});
