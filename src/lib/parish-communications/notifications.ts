import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  deliverParishMessage,
  getParishDeliveryConfig,
} from "@/lib/parish-communications/delivery-provider";

/**
 * Look up a student's email from user_profiles, along with course title and parish name.
 */
async function resolveNotificationData({
  clerkUserId,
  parishId,
  courseId,
}: {
  clerkUserId: string;
  parishId: string;
  courseId: string;
}): Promise<{ email: string | null; courseTitle: string; parishName: string } | null> {
  const supabase = getSupabaseAdminClient();

  const [{ data: profile }, { data: course }, { data: parish }] = await Promise.all([
    supabase.from("user_profiles").select("email").eq("clerk_user_id", clerkUserId).maybeSingle(),
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
    supabase.from("parishes").select("name").eq("id", parishId).maybeSingle(),
  ]);

  const email = (profile as { email: string | null } | null)?.email ?? null;
  const courseTitle = (course as { title: string } | null)?.title ?? "this course";
  const parishName = (parish as { name: string } | null)?.name ?? "your parish";

  return email ? { email, courseTitle, parishName } : null;
}

// ---------------------------------------------------------------------------
// Join request notifications
// ---------------------------------------------------------------------------

export async function notifyJoinRequestApproved({
  clerkUserId,
  parishId,
  courseId,
}: {
  clerkUserId: string;
  parishId: string;
  courseId: string;
}): Promise<void> {
  const config = getParishDeliveryConfig();
  if (!config.enabled || !config.provider) return;

  const data = await resolveNotificationData({ clerkUserId, parishId, courseId });
  if (!data) return;

  await deliverParishMessage({
    provider: config.provider,
    subject: `Your enrollment in ${data.courseTitle} is confirmed`,
    body: `Your request to join ${data.courseTitle} at ${data.parishName} has been approved. You can now access the course in your dashboard.`,
    recipients: [{ clerkUserId, email: data.email }],
  });
}

export async function notifyJoinRequestRejected({
  clerkUserId,
  parishId,
  courseId,
}: {
  clerkUserId: string;
  parishId: string;
  courseId: string;
}): Promise<void> {
  const config = getParishDeliveryConfig();
  if (!config.enabled || !config.provider) return;

  const data = await resolveNotificationData({ clerkUserId, parishId, courseId });
  if (!data) return;

  await deliverParishMessage({
    provider: config.provider,
    subject: `Update on your ${data.courseTitle} enrollment request`,
    body: `Your request to join ${data.courseTitle} was not approved. Please contact your parish admin if you have questions.`,
    recipients: [{ clerkUserId, email: data.email }],
  });
}

// ---------------------------------------------------------------------------
// Manual enrollment notification
// ---------------------------------------------------------------------------

export async function notifyEnrollmentConfirmed({
  clerkUserId,
  parishId,
  courseId,
}: {
  clerkUserId: string;
  parishId: string;
  courseId: string;
}): Promise<void> {
  const config = getParishDeliveryConfig();
  if (!config.enabled || !config.provider) return;

  const data = await resolveNotificationData({ clerkUserId, parishId, courseId });
  if (!data) return;

  await deliverParishMessage({
    provider: config.provider,
    subject: `You've been enrolled in ${data.courseTitle}`,
    body: `A parish administrator has enrolled you in ${data.courseTitle} at ${data.parishName}. Head to your dashboard to start learning.`,
    recipients: [{ clerkUserId, email: data.email }],
  });
}

// ---------------------------------------------------------------------------
// Course completion notification
// ---------------------------------------------------------------------------

export async function notifyCourseCompletion({
  clerkUserId,
  parishId,
  courseId,
}: {
  clerkUserId: string;
  parishId: string;
  courseId: string;
}): Promise<void> {
  const config = getParishDeliveryConfig();
  if (!config.enabled || !config.provider) return;

  const data = await resolveNotificationData({ clerkUserId, parishId, courseId });
  if (!data) return;

  await deliverParishMessage({
    provider: config.provider,
    subject: `You've completed ${data.courseTitle}!`,
    body: `Congratulations! You've finished all lessons in ${data.courseTitle}. Great work on your learning journey.`,
    recipients: [{ clerkUserId, email: data.email }],
  });
}