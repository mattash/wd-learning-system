import { buildTransactionalEmail } from "@/lib/email/build-transactional-email";
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

async function deliverTransactionalNotification(
  request: Parameters<typeof deliverParishMessage>[0],
) {
  const result = await deliverParishMessage(request);
  if (result?.failed.length) {
    const errors = Array.from(new Set(result.failed.map((failure) => failure.error)));
    throw new Error(errors.join("; ").slice(0, 500));
  }
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

  const message = await buildTransactionalEmail("approved", data);
  await deliverTransactionalNotification({
    provider: config.provider,
    subject: message.subject,
    body: message.text,
    html: message.html,
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

  const message = await buildTransactionalEmail("rejected", data);
  await deliverTransactionalNotification({
    provider: config.provider,
    subject: message.subject,
    body: message.text,
    html: message.html,
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

  const message = await buildTransactionalEmail("enrolled", data);
  await deliverTransactionalNotification({
    provider: config.provider,
    subject: message.subject,
    body: message.text,
    html: message.html,
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

  const message = await buildTransactionalEmail("completed", data);
  await deliverTransactionalNotification({
    provider: config.provider,
    subject: message.subject,
    body: message.text,
    html: message.html,
    recipients: [{ clerkUserId, email: data.email }],
  });
}
