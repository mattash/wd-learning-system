import { sendEmailViaResend } from "./providers/resend";

export type ParishDeliveryProvider = "mock" | "resend";

export interface ParishDeliveryConfig {
  enabled: boolean;
  provider: ParishDeliveryProvider | null;
  resendApiKey?: string;
  resendFromEmail?: string;
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

  if (mode === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      console.warn("[parish-communications] RESEND_API_KEY or RESEND_FROM_EMAIL not set — falling back to disabled");
      return { enabled: false, provider: null };
    }
    return { enabled: true, provider: "resend", resendApiKey: apiKey, resendFromEmail: fromEmail };
  }

  if (mode === "mock") {
    return { enabled: true, provider: "mock" };
  }

  return { enabled: false, provider: null };
}

export async function deliverParishMessage(request: ParishDeliveryRequest): Promise<ParishDeliveryResult> {
  if (request.provider === "mock") {
    const sent: string[] = [];
    const failed: Array<{ clerkUserId: string; error: string }> = [];

    for (const recipient of request.recipients) {
      if (!recipient.email) {
        failed.push({ clerkUserId: recipient.clerkUserId, error: "Recipient has no email on file." });
        continue;
      }
      sent.push(recipient.clerkUserId);
    }

    return { sent, failed };
  }

  if (request.provider === "resend") {
    const config = getParishDeliveryConfig();
    if (!config.enabled || !config.resendApiKey || !config.resendFromEmail) {
      throw new Error("Resend provider is not configured");
    }
    return sendEmailViaResend(
      { apiKey: config.resendApiKey, fromEmail: config.resendFromEmail },
      request,
    );
  }

  throw new Error(`Unsupported parish delivery provider: ${request.provider}`);
}