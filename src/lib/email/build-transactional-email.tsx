import { render } from "@react-email/render";
import {
  createTransactionalContent,
  type TransactionalEmailParams,
  type TransactionalEmailType,
} from "./transactional-content";
import { TransactionalEmail, transactionalText } from "./transactional-email";

export async function buildTransactionalEmail(
  type: TransactionalEmailType,
  params: TransactionalEmailParams,
) {
  const content = createTransactionalContent(type, params);
  return {
    subject: content.subject,
    text: transactionalText(content),
    html: await render(<TransactionalEmail content={content} />),
  };
}
