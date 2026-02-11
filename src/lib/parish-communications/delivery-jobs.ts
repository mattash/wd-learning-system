import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { deliverParishMessage, type ParishDeliveryProvider } from "@/lib/parish-communications/delivery-provider";

interface DeliveryJobRow {
  id: string;
  send_id: string;
  parish_id: string;
  provider: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  max_attempts: number;
}

interface SendRow {
  id: string;
  subject: string;
  body: string;
}

interface RecipientRow {
  clerk_user_id: string;
}

interface ProfileRow {
  clerk_user_id: string;
  email: string | null;
}

export interface ProcessParishDeliveryJobsResult {
  processed: number;
  sent: number;
  failed: number;
  requeued: number;
}

const MAX_JOB_BATCH = 50;

function buildRetryTime(attempts: number) {
  const backoffSeconds = Math.min(3600, Math.pow(2, Math.max(1, attempts)) * 30);
  return new Date(Date.now() + backoffSeconds * 1000).toISOString();
}

function summarizeFailureErrors(failed: Array<{ clerkUserId: string; error: string }>) {
  const unique = Array.from(new Set(failed.map((item) => item.error)));
  return unique.join("; ").slice(0, 500);
}

async function updateRecipientStatuses({
  sendId,
  sentRecipientIds,
  failed,
}: {
  sendId: string;
  sentRecipientIds: string[];
  failed: Array<{ clerkUserId: string; error: string }>;
}) {
  const supabase = getSupabaseAdminClient();
  const attemptedAt = new Date().toISOString();

  if (sentRecipientIds.length > 0) {
    const { error } = await supabase
      .from("parish_message_recipients")
      .update({
        delivery_status: "sent",
        delivery_attempted_at: attemptedAt,
        delivery_error: null,
      })
      .eq("send_id", sendId)
      .in("clerk_user_id", sentRecipientIds);
    if (error) throw error;
  }

  for (const failure of failed) {
    const { error } = await supabase
      .from("parish_message_recipients")
      .update({
        delivery_status: "failed",
        delivery_attempted_at: attemptedAt,
        delivery_error: failure.error,
      })
      .eq("send_id", sendId)
      .eq("clerk_user_id", failure.clerkUserId);
    if (error) throw error;
  }
}

async function finalizeJobAsSent(job: DeliveryJobRow) {
  const supabase = getSupabaseAdminClient();
  const attempts = job.attempts + 1;
  const [{ error: sendError }, { error: jobError }] = await Promise.all([
    supabase.from("parish_message_sends").update({ delivery_status: "sent" }).eq("id", job.send_id),
    supabase
      .from("parish_message_delivery_jobs")
      .update({
        status: "sent",
        attempts,
        last_error: null,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id),
  ]);

  if (sendError) throw sendError;
  if (jobError) throw jobError;
}

async function scheduleJobRetry({
  job,
  errorMessage,
}: {
  job: DeliveryJobRow;
  errorMessage: string;
}) {
  const supabase = getSupabaseAdminClient();
  const attempts = job.attempts + 1;
  const isTerminal = attempts >= job.max_attempts;
  const sendStatus = isTerminal ? "failed" : "queued";
  const jobStatus = isTerminal ? "failed" : "pending";
  const nextAttemptAt = isTerminal ? new Date().toISOString() : buildRetryTime(attempts);

  const [{ error: sendError }, { error: jobError }] = await Promise.all([
    supabase.from("parish_message_sends").update({ delivery_status: sendStatus }).eq("id", job.send_id),
    supabase
      .from("parish_message_delivery_jobs")
      .update({
        status: jobStatus,
        attempts,
        last_error: errorMessage,
        next_attempt_at: nextAttemptAt,
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id),
  ]);

  if (sendError) throw sendError;
  if (jobError) throw jobError;

  return { isTerminal };
}

export async function enqueueParishMessageDeliveryJob({
  parishId,
  sendId,
  provider,
}: {
  parishId: string;
  sendId: string;
  provider: ParishDeliveryProvider;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("parish_message_delivery_jobs").insert({
    parish_id: parishId,
    send_id: sendId,
    provider,
    status: "pending",
    attempts: 0,
    max_attempts: 5,
    next_attempt_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function processOneJob(job: DeliveryJobRow): Promise<"sent" | "failed" | "requeued"> {
  const supabase = getSupabaseAdminClient();
  const claimResult = await supabase
    .from("parish_message_delivery_jobs")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      locked_by: `api:${process.pid}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id,send_id,parish_id,provider,status,attempts,max_attempts")
    .maybeSingle();

  if (claimResult.error) throw claimResult.error;
  if (!claimResult.data) {
    return "requeued";
  }

  const claimed = claimResult.data as DeliveryJobRow;

  try {
    const sendResult = await supabase
      .from("parish_message_sends")
      .select("id,subject,body")
      .eq("id", claimed.send_id)
      .maybeSingle();
    if (sendResult.error) throw sendResult.error;
    const send = sendResult.data as SendRow | null;
    if (!send) {
      await scheduleJobRetry({ job: claimed, errorMessage: "Message send record is missing." });
      return claimed.attempts + 1 >= claimed.max_attempts ? "failed" : "requeued";
    }

    const recipientsResult = await supabase
      .from("parish_message_recipients")
      .select("clerk_user_id")
      .eq("send_id", claimed.send_id)
      .neq("delivery_status", "sent");
    if (recipientsResult.error) throw recipientsResult.error;
    const recipients = (recipientsResult.data ?? []) as RecipientRow[];

    if (recipients.length === 0) {
      await finalizeJobAsSent(claimed);
      return "sent";
    }

    const recipientIds = recipients.map((row) => row.clerk_user_id);
    const profilesResult = await supabase
      .from("user_profiles")
      .select("clerk_user_id,email")
      .in("clerk_user_id", recipientIds);
    if (profilesResult.error) throw profilesResult.error;
    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const profileByClerkId = new Map(profiles.map((profile) => [profile.clerk_user_id, profile]));

    const provider = claimed.provider as ParishDeliveryProvider;
    const result = await deliverParishMessage({
      provider,
      subject: send.subject,
      body: send.body,
      recipients: recipientIds.map((clerkUserId) => ({
        clerkUserId,
        email: profileByClerkId.get(clerkUserId)?.email ?? null,
      })),
    });

    await updateRecipientStatuses({
      sendId: claimed.send_id,
      sentRecipientIds: result.sent,
      failed: result.failed,
    });

    if (result.failed.length === 0) {
      await finalizeJobAsSent(claimed);
      return "sent";
    }

    const retryResult = await scheduleJobRetry({
      job: claimed,
      errorMessage: summarizeFailureErrors(result.failed),
    });
    return retryResult.isTerminal ? "failed" : "requeued";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delivery error.";
    const retryResult = await scheduleJobRetry({ job: claimed, errorMessage: message });
    return retryResult.isTerminal ? "failed" : "requeued";
  }
}

export async function processPendingParishMessageDeliveryJobs({
  limit = 10,
}: {
  limit?: number;
} = {}): Promise<ProcessParishDeliveryJobsResult> {
  const cappedLimit = Math.max(1, Math.min(limit, MAX_JOB_BATCH));
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("parish_message_delivery_jobs")
    .select("id,send_id,parish_id,provider,status,attempts,max_attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(cappedLimit);

  if (error) throw error;

  const jobs = (data ?? []) as DeliveryJobRow[];
  const summary: ProcessParishDeliveryJobsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    requeued: 0,
  };

  for (const job of jobs) {
    const status = await processOneJob(job);
    summary.processed += 1;
    if (status === "sent") summary.sent += 1;
    if (status === "failed") summary.failed += 1;
    if (status === "requeued") summary.requeued += 1;
  }

  return summary;
}
