import React from "react";
import { createTransactionalContent } from "../transactional-content";
import { TransactionalEmail } from "../transactional-email";

export interface JoinRequestConfirmationEmailProps {
  displayName: string;
  courseTitle: string;
  parishName: string;
  appUrl: string;
}

export default function JoinRequestConfirmationEmail(
  props: JoinRequestConfirmationEmailProps,
): React.ReactElement {
  return (
    <TransactionalEmail
      content={createTransactionalContent("submitted", props)}
    />
  );
}
