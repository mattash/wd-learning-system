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
  locked_at: string | null;
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
const STALE_PROCESSING_LOCK_MS = 15 * 60 * 1000;
const INTERRUPTED_DELIVERY_ERROR =
  "Delivery was interrupted after dispatch may have started; automatic retry was stopped to avoid duplicate email.";

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
  sent,
  failed,
}: {
  sendId: string;
  sent: Array<{ clerkUserId: string; providerMessageId: string | null }>;
  failed: Array<{ clerkUserId: string; error: string }>;
}) {
  const supabase = getSupabaseAdminClient();
  const attemptedAt = new Date().toISOString();

  for (const success of sent) {
    const { error } = await supabase
      .from("parish_message_recipients")
      .update({
        delivery_status: "sent",
        delivery_attempted_at: attemptedAt,
        provider_message_id: success.providerMessageId,
        delivery_error: null,
      })
      .eq("send_id", sendId)
      .eq("clerk_user_id", success.clerkUserId);
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

async function markJobAsFailedWithoutRetry({
  job,
  errorMessage,
}: {
  job: DeliveryJobRow;
  errorMessage: string;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const attempts = job.attempts + 1;

  try {
    let terminalUpdate = supabase
      .from("parish_message_delivery_jobs")
      .update({
        status: "failed",
        attempts,
        last_error: errorMessage,
        locked_at: null,
        locked_by: null,
        updated_at: now,
      })
      .eq("id", job.id)
      .eq("status", "processing");

    if (job.locked_at) {
      terminalUpdate = terminalUpdate.eq("locked_at", job.locked_at);
    }

    const { data: terminalJob, error: jobError } = await terminalUpdate
      .select("id")
      .maybeSingle();
    if (jobError) {
      console.error("[parish-communications] failed to persist terminal job state:", jobError);
      return false;
    }
    if (!terminalJob) {
      return false;
    }

    const [{ error: sendError }, { error: recipientError }] = await Promise.all([
      supabase.from("parish_message_sends").update({ delivery_status: "failed" }).eq("id", job.send_id),
      supabase
        .from("parish_message_recipients")
        .update({
          delivery_status: "failed",
          delivery_attempted_at: now,
          delivery_error: errorMessage,
        })
        .eq("send_id", job.send_id)
        .neq("delivery_status", "sent"),
    ]);

    if (sendError) {
      console.error("[parish-communications] failed to persist terminal send state:", sendError);
    }
    if (recipientError) {
      console.error("[parish-communications] failed to persist terminal recipient state:", recipientError);
    }

    return true;
  } catch (error) {
    console.error("[parish-communications] failed closed after uncertain delivery:", error);
    return false;
  }
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
  const lockedAt = new Date().toISOString();
  const claimResult = await supabase
    .from("parish_message_delivery_jobs")
    .update({
      status: "processing",
      locked_at: lockedAt,
      locked_by: `api:${process.pid}`,
      updated_at: lockedAt,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id,send_id,parish_id,provider,status,attempts,max_attempts,locked_at")
    .maybeSingle();

  if (claimResult.error) throw claimResult.error;
  if (!claimResult.data) {
    return "requeued";
  }

  const claimed = claimResult.data as DeliveryJobRow;
  let dispatchStarted = false;

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
    dispatchStarted = true;
    const result = await deliverParishMessage({
      provider,
      subject: send.subject,
      body: send.body,
      recipients: recipientIds.map((clerkUserId) => ({
        clerkUserId,
        email: profileByClerkId.get(clerkUserId)?.email ?? null,
      })),
      idempotencyKey: `parish-message/${claimed.send_id}`,
    });

    try {
      await updateRecipientStatuses({
        sendId: claimed.send_id,
        sent: result.sent,
        failed: result.failed,
      });
    } catch {
      await markJobAsFailedWithoutRetry({
        job: claimed,
        errorMessage: INTERRUPTED_DELIVERY_ERROR,
      });
      return "failed";
    }

    if (result.failed.length === 0) {
      await finalizeJobAsSent(claimed);
      return "sent";
    }

    await markJobAsFailedWithoutRetry({
      job: claimed,
      errorMessage: summarizeFailureErrors(result.failed),
    });
    return "failed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delivery error.";

    if (dispatchStarted) {
      await markJobAsFailedWithoutRetry({
        job: claimed,
        errorMessage: INTERRUPTED_DELIVERY_ERROR,
      });
      return "failed";
    }

    const retryResult = await scheduleJobRetry({ job: claimed, errorMessage: message });
    return retryResult.isTerminal ? "failed" : "requeued";
  }
}

async function failStaleProcessingJobs(limit: number) {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() - STALE_PROCESSING_LOCK_MS).toISOString();
  const { data, error } = await supabase
    .from("parish_message_delivery_jobs")
    .select("id,send_id,parish_id,provider,status,attempts,max_attempts,locked_at")
    .eq("status", "processing")
    .lt("locked_at", cutoff)
    .order("locked_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const jobs = (data ?? []) as DeliveryJobRow[];
  for (const job of jobs) {
    await markJobAsFailedWithoutRetry({
      job,
      errorMessage: INTERRUPTED_DELIVERY_ERROR,
    });
  }

  return jobs.length;
}

export async function processParishMessageDeliveryJobBySendId({
  sendId,
}: {
  sendId: string;
}): Promise<"sent" | "failed" | "requeued" | "not_found"> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parish_message_delivery_jobs")
    .select("id,send_id,parish_id,provider,status,attempts,max_attempts,locked_at")
    .eq("send_id", sendId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) throw error;
  if (!data) return "not_found";

  return processOneJob(data as DeliveryJobRow);
}

export async function processPendingParishMessageDeliveryJobs({
  limit = 10,
}: {
  limit?: number;
} = {}): Promise<ProcessParishDeliveryJobsResult> {
  const cappedLimit = Math.max(1, Math.min(limit, MAX_JOB_BATCH));
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const recoveredFailures = await failStaleProcessingJobs(cappedLimit);

  const { data, error } = await supabase
    .from("parish_message_delivery_jobs")
    .select("id,send_id,parish_id,provider,status,attempts,max_attempts,locked_at")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(cappedLimit);

  if (error) throw error;

  const jobs = (data ?? []) as DeliveryJobRow[];
  const summary: ProcessParishDeliveryJobsResult = {
    processed: recoveredFailures,
    sent: 0,
    failed: recoveredFailures,
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
