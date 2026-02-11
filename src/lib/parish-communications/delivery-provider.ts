export type ParishDeliveryProvider = "mock";

export interface ParishDeliveryConfig {
  enabled: boolean;
  provider: ParishDeliveryProvider | null;
}

export interface ParishDeliveryRecipient {
  clerkUserId: string;
  email: string | null;
}

export interface ParishDeliveryRequest {
  provider: ParishDeliveryProvider;
  subject: string;
  body: string;
  recipients: ParishDeliveryRecipient[];
}

export interface ParishDeliveryResult {
  sent: string[];
  failed: Array<{ clerkUserId: string; error: string }>;
}

export function getParishDeliveryConfig(): ParishDeliveryConfig {
  const mode = (process.env.PARISH_COMMUNICATIONS_DELIVERY_MODE ?? "disabled").toLowerCase();
  if (mode === "mock") {
    return { enabled: true, provider: "mock" };
  }
  return { enabled: false, provider: null };
}

export async function deliverParishMessage(request: ParishDeliveryRequest): Promise<ParishDeliveryResult> {
  if (request.provider !== "mock") {
    throw new Error(`Unsupported parish delivery provider: ${request.provider}`);
  }

  const sent: string[] = [];
  const failed: Array<{ clerkUserId: string; error: string }> = [];

  for (const recipient of request.recipients) {
    if (!recipient.email) {
      failed.push({
        clerkUserId: recipient.clerkUserId,
        error: "Recipient has no email on file.",
      });
      continue;
    }
    sent.push(recipient.clerkUserId);
  }

  return { sent, failed };
}
