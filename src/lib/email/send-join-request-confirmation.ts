import JoinRequestConfirmationEmail, {
  type JoinRequestConfirmationEmailProps,
} from "./templates/join-request-confirmation";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export interface SendJoinRequestConfirmationParams {
  toEmail: string;
  displayName: string;
  courseTitle: string;
  parishName: string;
}

/**
 * Send a confirmation email to a student after their join request is
 * submitted.  Non-blocking — logs errors but never throws.
 */
export async function sendJoinRequestConfirmation(
  params: SendJoinRequestConfirmationParams,
): Promise<void> {
  const { toEmail, displayName, courseTitle, parishName } = params;

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.warn(
      "[join-request-confirmation] RESEND_API_KEY or RESEND_FROM_EMAIL not configured — skipping email",
    );
    return;
  }

  const props: JoinRequestConfirmationEmailProps = {
    displayName,
    courseTitle,
    parishName,
    appUrl,
  };

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Your enrollment request for ${courseTitle} has been submitted`,
      react: JoinRequestConfirmationEmail(props),
    });

    if (error) {
      console.error("[join-request-confirmation] Resend API error:", error);
    }
  } catch (err) {
    console.error(
      "[join-request-confirmation] Failed to send confirmation email:",
      err instanceof Error ? err.message : err,
    );
  }
}
