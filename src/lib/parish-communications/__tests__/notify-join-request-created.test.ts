import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { notifyJoinRequestCreated } from "../notify-join-request-created";
import { deliverParishMessage, getParishDeliveryConfig } from "../delivery-provider";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

vi.mock("../delivery-provider", () => ({ deliverParishMessage: vi.fn(), getParishDeliveryConfig: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient: vi.fn() }));
const request = { id: "r1", parishId: "p1", clerkUserId: "student", courseId: "c1", status: "PENDING" as const, createdAt: "", updatedAt: "" };
const memberships = [
  { parish_id: "p1", role: "parish_admin", clerk_user_id: "a1" },
  { parish_id: "p1", role: "parish_admin", clerk_user_id: "a1" },
  { parish_id: "p1", role: "parish_admin", clerk_user_id: "a2" },
  { parish_id: "p1", role: "parish_admin", clerk_user_id: "a3" },
  { parish_id: "p1", role: "parish_admin", clerk_user_id: "a4" },
  { parish_id: "p2", role: "parish_admin", clerk_user_id: "other" },
  { parish_id: "p1", role: "student", clerk_user_id: "student" },
  { parish_id: "p1", role: "instructor", clerk_user_id: "teacher" },
];
const profiles = [
  { clerk_user_id: "a1", email: " Admin@example.com " },
  { clerk_user_id: "a1", email: "Admin@example.com" },
  { clerk_user_id: "a2", email: "admin@EXAMPLE.com" },
  { clerk_user_id: "a3", email: null },
  { clerk_user_id: "a4", email: "second@example.com" },
  ...["other", "student", "teacher", "revoked"].map((id) => ({ clerk_user_id: id, email: `${id}@example.com` })),
];
function database({ rows = memberships, emails = profiles, errorTable = "", missingDetails = false } = {}) {
  const from = vi.fn((table: string) => {
    let data: Record<string, unknown>[] = table === "parish_memberships" ? rows : table === "user_profiles" ? [...emails, { clerk_user_id: "student", display_name: "Ani" }] : table === "courses" ? [{ id: "c1", title: "Armenian Basics" }] : [{ id: "p1", name: "St. John" }];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { data = data.filter((row) => row[key] === value); return query; }),
      in: vi.fn((key: string, values: unknown[]) => { data = data.filter((row) => values.includes(row[key])); return query; }),
      maybeSingle: vi.fn(async () => ({ data: missingDetails ? null : data.find((row) => row.display_name) ?? data[0] ?? null, error: table === errorTable ? new Error("private") : null })),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data, error: table === errorTable ? new Error("private") : null }).then(resolve),
    };
    return query;
  });
  vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);
  return from;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://learning.example.com");
  vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: true, provider: "mock" });
  vi.mocked(deliverParishMessage).mockResolvedValue({ sent: [], failed: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("resolves only current parish admins, deduplicates accounts and mailboxes, and skips missing email", async () => {
  database();
  await notifyJoinRequestCreated(request);
  expect(deliverParishMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    recipients: [{ clerkUserId: "a1", email: "admin@example.com" }, { clerkUserId: "a4", email: "second@example.com" }],
    idempotencyKey: "join-request/r1/admin-request",
    subject: "New enrollment request for Armenian Basics",
  }));
  const payload = vi.mocked(deliverParishMessage).mock.calls[0][0];
  for (const body of [payload.body, payload.html]) {
    for (const text of ["Ani", "Armenian Basics", "St. John", "Action needed", "https://learning.example.com/app/parish-admin/join-requests"]) expect(body).toContain(text);
    expect(body).not.toContain("@example.com");
    expect(body).not.toContain("student");
  }
});
it.each(["parish_memberships", "user_profiles", "courses", "parishes"])("fails closed on %s lookup errors", async (errorTable) => {
  database({ errorTable });
  await expect(notifyJoinRequestCreated(request)).rejects.toThrow("private");
  expect(deliverParishMessage).not.toHaveBeenCalled();
});
it("skips when delivery is disabled", async () => {
  vi.mocked(getParishDeliveryConfig).mockReturnValue({ enabled: false, provider: null });
  await notifyJoinRequestCreated(request);
  expect(getSupabaseAdminClient).not.toHaveBeenCalled();
});
it.each([{ rows: [] }, { rows: memberships.filter((m) => m.parish_id !== "p1" || m.role !== "parish_admin") }])("skips without current admin memberships", async ({ rows }) => {
  database({ rows });
  await notifyJoinRequestCreated(request);
  expect(deliverParishMessage).not.toHaveBeenCalled();
});
it("skips empty, missing and whitespace-only emails", async () => {
  database({ emails: [{ clerk_user_id: "a1", email: " " }, { clerk_user_id: "a2", email: "" }, { clerk_user_id: "a3", email: null }] });
  await notifyJoinRequestCreated(request);
  expect(deliverParishMessage).not.toHaveBeenCalled();
});
it("uses safe fallback labels for missing details", async () => {
  database({ missingDetails: true });
  await notifyJoinRequestCreated(request);
  expect(vi.mocked(deliverParishMessage).mock.calls[0][0].body).toContain("A student has requested enrollment in the requested course at your parish.");
});
it("reports partial failure without copying provider details", async () => {
  database();
  vi.mocked(deliverParishMessage).mockResolvedValue({ sent: [], failed: [{ clerkUserId: "a1", error: "secret admin@example.com" }] });
  await expect(notifyJoinRequestCreated(request)).rejects.toThrow(/^Admin request notification delivery failed$/);
});
