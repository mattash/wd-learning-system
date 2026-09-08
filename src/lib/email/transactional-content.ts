import type { TransactionalContent } from "./transactional-email";

export type TransactionalEmailType =
  "admin-request" | "submitted" | "approved" | "rejected" | "enrolled" | "completed";

export interface TransactionalEmailParams {
  courseTitle: string;
  parishName: string;
  displayName?: string;
  appUrl?: string;
}

function applicationOrigin(appUrl?: string): URL {
  const base = new URL(
    appUrl ??
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  );
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw new Error(
      "Email application URL must be an HTTP(S) URL without credentials",
    );
  }
  return new URL(base.origin);
}

export function createTransactionalContent(
  type: TransactionalEmailType,
  { courseTitle, parishName, displayName, appUrl }: TransactionalEmailParams,
): TransactionalContent {
  const messages: Record<
    TransactionalEmailType,
    Omit<TransactionalContent, "ctaUrl" | "markUrl"> & { path: string }
  > = {
    "admin-request": {
      subject: `New enrollment request for ${courseTitle}`,
      heading: "New Enrollment Request",
      preheader: `Action needed: review a new enrollment request for ${courseTitle}.`,
      status: "Action needed: review enrollment request",
      tone: "pending",
      paragraphs: [
        `${displayName?.trim() || "A student"} has requested enrollment in ${courseTitle} at ${parishName}.`,
        "Review the request to approve or decline enrollment.",
      ],
      ctaLabel: "Review Enrollment Requests",
      path: "/app/parish-admin/join-requests",
    },
    submitted: {
      subject: `Your enrollment request for ${courseTitle} has been submitted`,
      heading: "Enrollment Request Submitted",
      preheader: `Your request for ${courseTitle} is awaiting parish review.`,
      status: "Awaiting review",
      tone: "pending",
      paragraphs: [
        ...(displayName ? [`Hi ${displayName},`] : []),
        `Your request to enroll in ${courseTitle} at ${parishName} has been submitted for review.`,
        "A parish administrator will review your request. You will receive another email with the enrollment decision.",
      ],
      ctaLabel: "Browse More Courses",
      path: "/app/catalog",
    },
    approved: {
      subject: `Your enrollment in ${courseTitle} is confirmed`,
      heading: "Enrollment Request Approved",
      preheader: `Your enrollment in ${courseTitle} is confirmed. Start learning in your dashboard.`,
      status: "Enrollment approved",
      tone: "success",
      paragraphs: [
        `Your request to join ${courseTitle} at ${parishName} has been approved. You can now access the course in your dashboard.`,
      ],
      ctaLabel: "Open Your Learning Dashboard",
      path: "/app/dashboard",
    },
    rejected: {
      subject: `Update on your ${courseTitle} enrollment request`,
      heading: "Enrollment Request Update",
      preheader: `There is an update on your request to join ${courseTitle}.`,
      status: "Enrollment request not approved",
      tone: "neutral",
      paragraphs: [
        `Your request to join ${courseTitle} was not approved. Please contact your parish admin if you have questions.`,
      ],
      ctaLabel: "Browse Available Courses",
      path: "/app/catalog",
    },
    enrolled: {
      subject: `You've been enrolled in ${courseTitle}`,
      heading: "Enrollment Confirmed",
      preheader: `A parish administrator has enrolled you in ${courseTitle}.`,
      status: "Ready to start learning",
      tone: "success",
      paragraphs: [
        `A parish administrator has enrolled you in ${courseTitle} at ${parishName}. Head to your dashboard to start learning.`,
      ],
      ctaLabel: "Open Your Learning Dashboard",
      path: "/app/dashboard",
    },
    completed: {
      subject: `You've completed ${courseTitle}!`,
      heading: "Course Completed",
      preheader: `Congratulations on completing ${courseTitle}!`,
      status: "All lessons completed",
      tone: "success",
      paragraphs: [
        `Congratulations! You've finished all lessons in ${courseTitle}. Great work on your learning journey.`,
      ],
      ctaLabel: "View Your Learning Dashboard",
      path: "/app/dashboard",
    },
  };
  const { path, ...content } = messages[type];
  const origin = applicationOrigin(appUrl);
  const ctaUrl = new URL(path, origin).href;
  // Remote email assets always use HTTPS, including HTTP development origins.
  origin.protocol = "https:";
  const markUrl = new URL("/branding/st-john-learning-mark.png", origin).href;
  return { ...content, ctaUrl, markUrl };
}
