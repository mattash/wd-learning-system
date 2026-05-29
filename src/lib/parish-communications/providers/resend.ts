import type { ParishDeliveryRequest, ParishDeliveryResult } from "../delivery-provider";

export type ResendDeliveryProvider = "resend";

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

const RESEND_BATCH_API_URL = "https://api.resend.com/emails/batch";

export async function sendEmailViaResend(
  config: ResendConfig,
  request: ParishDeliveryRequest,
): Promise<ParishDeliveryResult> {
  const sent: string[] = [];
  const failed: Array<{ clerkUserId: string; error: string }> = [];

  // Send to up to 100 recipients per batch (Resend batch limit)
  const BATCH_SIZE = 100;
  for (let i = 0; i < request.recipients.length; i += BATCH_SIZE) {
    const batch = request.recipients.slice(i, i + BATCH_SIZE);
    const recipientsWithEmail = batch.filter((r): r is typeof r & { email: string } => r.email !== null);
    const recipientsWithoutEmail = batch.filter((r) => r.email === null);

    if (recipientsWithEmail.length === 0) {
      for (const recipient of recipientsWithoutEmail) {
        failed.push({ clerkUserId: recipient.clerkUserId, error: "Recipient has no email on file." });
      }
      continue;
    }

    const batchPayload = recipientsWithEmail.map((r) => ({
      from: config.fromEmail,
      to: [r.email],
      subject: request.subject,
      text: request.body,
    }));

    try {
      const response = await fetch(RESEND_BATCH_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batchPayload),
      });

      if (response.ok) {
        const data = await response.json() as { data?: Array<{ id?: string }> };
        const ids = data.data;
        const allHaveIds =
          Array.isArray(ids) &&
          ids.length === recipientsWithEmail.length &&
          ids.every((item) => Boolean(item?.id));

        if (allHaveIds) {
          for (const recipient of recipientsWithEmail) {
            sent.push(recipient.clerkUserId);
          }
        } else {
          const errMsg = "Resend batch response missing email ids";
          for (const recipient of recipientsWithEmail) {
            failed.push({ clerkUserId: recipient.clerkUserId, error: errMsg });
          }
        }
      } else {
        const errorBody = await response.text();
        const errMsg = `Resend API error ${response.status}: ${errorBody}`;
        for (const recipient of batch) {
          failed.push({
            clerkUserId: recipient.clerkUserId,
            error: recipient.email ? errMsg : "Recipient has no email on file.",
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      for (const recipient of batch) {
        failed.push({
          clerkUserId: recipient.clerkUserId,
          error: recipient.email ? message : "Recipient has no email on file.",
        });
      }
    }
  }

  return { sent, failed };
}