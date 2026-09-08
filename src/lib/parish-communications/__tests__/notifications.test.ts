import { buildTransactionalEmail } from "@/lib/email/build-transactional-email";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/test/supabase-route-mocks";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/parish-communications/delivery-provider", () => ({
  getParishDeliveryConfig: vi.fn(),
  deliverParishMessage: vi.fn(),
}));

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getParishDeliveryConfig, deliverParishMessage } from "@/lib/parish-communications/delivery-provider";
import {
  notifyCourseCompletion,
  notifyJoinRequestApproved,
  notifyJoinRequestRejected,
  notifyEnrollmentConfirmed,
} from "@/lib/parish-communications/notifications";

describe("notifyCourseCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when delivery is disabled", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: false, provider: null });
    await notifyCourseCompletion({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when provider is not configured", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: null });
    await notifyCourseCompletion({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when user has no email", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
      })),
    }));
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);
    await notifyCourseCompletion({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("sends course completion email with correct data", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });

    let callIdx = 0;
    const fromMock = vi.fn(() => {
      callIdx++;
      if (callIdx === 1) {
        // user_profiles
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ email: "user@test.com" })) })) })) };
      } else if (callIdx === 2) {
        // courses
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ title: "Armenian Basics" })) })) })) };
      } else {
        // parishes
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ name: "St. John" })) })) })) };
      }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as never);

    await notifyCourseCompletion({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(deliverParishMessage).toHaveBeenCalledOnce();
    expect(deliverParishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "mock",
        subject: "You've completed Armenian Basics!",
        html: expect.stringContaining("St. John Learning"),
        body: expect.stringContaining("Armenian Basics"),
        recipients: [{ clerkUserId: "user-1", email: "user@test.com" }],
      }),
    );
  });
});

describe("notifyJoinRequestApproved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when delivery is disabled", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: false, provider: null });
    await notifyJoinRequestApproved({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when provider is not configured", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: null });
    await notifyJoinRequestApproved({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when user has no email", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        })),
      })),
    } as never);
    await notifyJoinRequestApproved({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("sends approval email with correct subject and body", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });

    let callIdx = 0;
    const fromMock = vi.fn(() => {
      callIdx++;
      if (callIdx === 1) {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ email: "user@test.com" })) })) })) };
      } else if (callIdx === 2) {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ title: "Advanced Armenian" })) })) })) };
      } else {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ name: "St. John" })) })) })) };
      }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as never);

    await notifyJoinRequestApproved({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(deliverParishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your enrollment in Advanced Armenian is confirmed",
        html: expect.stringContaining("St. John Learning"),
        body: expect.stringContaining("Advanced Armenian"),
        recipients: [{ clerkUserId: "user-1", email: "user@test.com" }],
      }),
    );
  });
});

describe("notifyJoinRequestRejected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when delivery is disabled", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: false, provider: null });
    await notifyJoinRequestRejected({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when provider is not configured", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: null });
    await notifyJoinRequestRejected({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when user has no email", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        })),
      })),
    } as never);
    await notifyJoinRequestRejected({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("sends rejection email with correct subject and body", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });

    let callIdx = 0;
    const fromMock = vi.fn(() => {
      callIdx++;
      if (callIdx === 1) {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ email: "user@test.com" })) })) })) };
      } else if (callIdx === 2) {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ title: "Advanced Armenian" })) })) })) };
      } else {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ name: "St. John" })) })) })) };
      }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as never);

    await notifyJoinRequestRejected({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(deliverParishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Update on your Advanced Armenian enrollment request",
        html: expect.stringContaining("St. John Learning"),
        body: expect.stringContaining("not approved"),
        recipients: [{ clerkUserId: "user-1", email: "user@test.com" }],
      }),
    );
  });
});

describe("notifyEnrollmentConfirmed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when delivery is disabled", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: false, provider: null });
    await notifyEnrollmentConfirmed({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when provider is not configured", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: null });
    await notifyEnrollmentConfirmed({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("does nothing when user has no email", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        })),
      })),
    } as never);
    await notifyEnrollmentConfirmed({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });
    expect(deliverParishMessage).not.toHaveBeenCalled();
  });

  it("sends enrollment confirmation email with correct data", async () => {
    vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });

    let callIdx = 0;
    const fromMock = vi.fn(() => {
      callIdx++;
      if (callIdx === 1) {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ email: "user@test.com" })) })) })) };
      } else if (callIdx === 2) {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ title: "Liturgy 101" })) })) })) };
      } else {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok({ name: "St. John" })) })) })) };
      }
    });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({ from: fromMock } as never);

    await notifyEnrollmentConfirmed({
      clerkUserId: "user-1",
      parishId: "parish-1",
      courseId: "course-1",
    });

    expect(deliverParishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "You've been enrolled in Liturgy 101",
        html: expect.stringContaining("St. John Learning"),
        body: expect.stringContaining("Liturgy 101"),
        recipients: [{ clerkUserId: "user-1", email: "user@test.com" }],
      }),
    );
  });
});
const notificationCases = [
  [notifyJoinRequestApproved, "approved"],
  [notifyJoinRequestRejected, "rejected"],
  [notifyEnrollmentConfirmed, "enrolled"],
  [notifyCourseCompletion, "completed"],
] as const;


it.each(notificationCases)("delivers shared HTML/text for %s", async (notify, type) => {
  vi.clearAllMocks();
  vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
  vi.mocked(deliverParishMessage).mockResolvedValue({ sent: [], failed: [] });
  const data: Record<string, unknown> = {
    user_profiles: { email: "ani@example.com" }, courses: { title: "Armenian & <Basics>" }, parishes: { name: "St. John" },
  };
  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    from: vi.fn((table: string) => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok(data[table])) })) })) })),
  } as never);
  await notify({ clerkUserId: "u-1", courseId: "c-1", parishId: "p-1" });
  const message = await buildTransactionalEmail(type, { courseTitle: "Armenian & <Basics>", parishName: "St. John" });
  expect(deliverParishMessage).toHaveBeenCalledExactlyOnceWith({
    provider: "mock", subject: message.subject, body: message.text, html: message.html,
    recipients: [{ clerkUserId: "u-1", email: "ani@example.com" }],
  });
});

it("preserves fallback data and propagates deduplicated delivery failures", async () => {
  vi.clearAllMocks();
  vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
  vi.mocked(getSupabaseAdminClient).mockReturnValue({
    from: vi.fn((table: string) => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ok(table === "user_profiles" ? { email: "ani@example.com" } : null)) })) })) })),
  } as never);
  vi.mocked(deliverParishMessage).mockResolvedValue({ sent: [], failed: [{ clerkUserId: "u-1", error: "failed" }, { clerkUserId: "u-1", error: "failed" }] });
  await expect(notifyJoinRequestApproved({ clerkUserId: "u-1", courseId: "c-1", parishId: "p-1" })).rejects.toThrow(/^failed$/);
  expect(deliverParishMessage).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("this course at your parish") }));
});
