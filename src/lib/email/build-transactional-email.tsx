import { render } from "@react-email/render";
import {
  applicationOrigin,
  createTransactionalContent,
  type TransactionalEmailParams,
  type TransactionalEmailType,
} from "./transactional-content";
import { TransactionalEmail, transactionalText, type TransactionalContent } from "./transactional-email";

export async function buildTransactionalEmail(
  type: TransactionalEmailType,
  params: TransactionalEmailParams,
) {
  const content = createTransactionalContent(type, params);
  return buildBrandedEmail(content);
}

export async function buildParishMessageEmail({
  subject,
  body,
  appUrl,
}: {
  subject: string;
  body: string;
  appUrl?: string;
}) {
  const origin = applicationOrigin(appUrl);
  const ctaUrl = new URL("/app/dashboard", origin).href;
  origin.protocol = "https:";
  return buildBrandedEmail({
    subject,
    heading: subject,
    preheader: subject,
    paragraphs: [body],
    status: "Message from your parish administrator",
    tone: "neutral",
    ctaLabel: "Open Your Learning Dashboard",
    ctaUrl,
    markUrl: new URL("/branding/st-john-learning-mark.png", origin).href,
  });
}

async function buildBrandedEmail(content: TransactionalContent) {
  return {
    subject: content.subject,
    text: transactionalText(content),
    html: await render(<TransactionalEmail content={content} />),
  };
}
