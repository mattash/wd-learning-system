import { buildTransactionalEmail } from "@/lib/email/build-transactional-email";
import type { CourseJoinRequest } from "@/lib/repositories/course-join-requests";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { deliverParishMessage, getParishDeliveryConfig } from "./delivery-provider";

/** Called once after insertion; the creation boundary isolates all failures. */
export async function notifyJoinRequestCreated(request: CourseJoinRequest): Promise<void> {
  const config = getParishDeliveryConfig();
  if (!config.enabled || !config.provider) return;
  const supabase = getSupabaseAdminClient();
  // Current membership is authoritative: revoked access deletes the row.
  // Neither memberships nor profiles have a separate active/status column.
  const { data: memberships, error: membershipError } = await supabase
    .from("parish_memberships")
    .select("clerk_user_id")
    .eq("parish_id", request.parishId)
    .eq("role", "parish_admin");
  if (membershipError) throw membershipError;
  const adminIds = [...new Set((memberships ?? []).map((row) => row.clerk_user_id as string))];
  if (!adminIds.length) return;

  const [profiles, student, course, parish] = await Promise.all([
    supabase.from("user_profiles").select("clerk_user_id,email").in("clerk_user_id", adminIds),
    supabase.from("user_profiles").select("display_name").eq("clerk_user_id", request.clerkUserId).maybeSingle(),
    supabase.from("courses").select("title").eq("id", request.courseId).maybeSingle(),
    supabase.from("parishes").select("name").eq("id", request.parishId).maybeSingle(),
  ]);
  for (const result of [profiles, student, course, parish]) {
    if (result.error) throw result.error;
  }
  const seenEmails = new Set<string>();
  const seenUsers = new Set<string>();
  const recipients = (profiles.data ?? [])
    .map((profile) => ({ clerkUserId: profile.clerk_user_id as string, email: (profile.email as string | null)?.trim().toLowerCase() }))
    .sort((a, b) => a.clerkUserId.localeCompare(b.clerkUserId))
    .flatMap(({ clerkUserId, email }) => {
      if (!adminIds.includes(clerkUserId) || !email || seenEmails.has(email) || seenUsers.has(clerkUserId)) return [];
      seenEmails.add(email);
      seenUsers.add(clerkUserId);
      return [{ clerkUserId, email }];
    });
  if (!recipients.length) return;
  const message = await buildTransactionalEmail("admin-request", {
    displayName: (student.data as { display_name: string | null } | null)?.display_name ?? undefined,
    courseTitle: (course.data as { title: string } | null)?.title ?? "the requested course",
    parishName: (parish.data as { name: string } | null)?.name ?? "your parish",
  });
  const result = await deliverParishMessage({
    provider: config.provider,
    subject: message.subject,
    body: message.text,
    html: message.html,
    recipients,
    idempotencyKey: `join-request/${request.id}/admin-request`,
  });
  if (result.failed.length) throw new Error("Admin request notification delivery failed");
}
