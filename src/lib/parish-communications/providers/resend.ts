import type { ParishDeliveryRequest, ParishDeliveryResult } from "../delivery-provider";

export type ResendDeliveryProvider = "resend";

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

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
    const toEmails = batch.map((r) => r.email).filter((e): e is string => e !== null);

    if (toEmails.length === 0) continue;

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: toEmails,
          subject: request.subject,
          text: request.body,
        }),
      });

      if (response.ok) {
        // Add all recipients with valid emails to sent
        for (const recipient of batch) {
          if (recipient.email) {
            sent.push(recipient.clerkUserId);
          }
        }
      } else {
        const errorBody = await response.text();
        for (const recipient of batch) {
          if (recipient.email) {
            failed.push({
              clerkUserId: recipient.clerkUserId,
              error: `Resend API error ${response.status}: ${errorBody}`,
            });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      for (const recipient of batch) {
        if (recipient.email) {
          failed.push({ clerkUserId: recipient.clerkUserId, error: message });
        }
      }
    }
  }

  return { sent, failed };
}