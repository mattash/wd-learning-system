/* eslint-disable @next/next/no-head-element -- Standalone email document, not a Next.js page. */
import React from "react";

// Frozen email-safe light-theme equivalents; see docs/design-system.md.
export const emailTokens = Object.freeze({
  crimson: "#870024",
  gold: "#be7c1c",
  background: "#f3f6fa",
  surface: "#ffffff",
  text: "#0d151b",
  secondary: "#474e54",
  border: "#dbe0e5",
  pending: "#f7efe2",
  success: "#e2f2e8",
  neutral: "#f3f6fa",
});

export interface TransactionalContent {
  subject: string;
  heading: string;
  preheader: string;
  paragraphs: string[];
  status: string;
  tone: "pending" | "success" | "neutral";
  ctaLabel: string;
  ctaUrl: string;
  markUrl: string;
}

const bodyFont =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const displayFont = 'Georgia, "Times New Roman", Times, serif';
const footer =
  "If you have questions, please contact your parish administrator.";

export function transactionalText(content: TransactionalContent): string {
  return [
    "St. John Learning",
    "St. John Armenian Apostolic Church",
    content.heading,
    content.status,
    ...content.paragraphs,
    `${content.ctaLabel}: ${content.ctaUrl}`,
    footer,
  ].join("\n\n");
}

export function TransactionalEmail({
  content,
}: {
  content: TransactionalContent;
}): React.ReactElement {
  return (
    <html lang="en">
      {/* Static only: Word-based Outlook supports width, but ignores max-width.
          Keep its fixed-width override hidden from responsive email clients.
          Never interpolate message content into this raw conditional markup. */}
      <head
        dangerouslySetInnerHTML={{
          __html: `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>St. John Learning</title>
<!--[if mso]><style type="text/css">#email-card { width: 600px !important; }</style><![endif]-->`,
        }}
      />
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: emailTokens.background,
          color: emailTokens.text,
          fontFamily: bodyFont,
          fontSize: "16px",
          lineHeight: "26px",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            display: "none",
            visibility: "hidden",
            maxHeight: 0,
            maxWidth: 0,
            overflow: "hidden",
            opacity: 0,
            fontSize: "1px",
            lineHeight: "1px",
          }}
        >
          {content.preheader}
        </div>
        <table
          role="presentation"
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          style={{
            backgroundColor: emailTokens.background,
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table
                  id="email-card"
                  role="presentation"
                  align="center"
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  style={{
                    maxWidth: "600px",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                    backgroundColor: emailTokens.surface,
                    border: `1px solid ${emailTokens.border}`,
                    borderTop: `4px solid ${emailTokens.crimson}`,
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          padding: "28px 24px 20px",
                          borderBottom: `2px solid ${emailTokens.gold}`,
                          overflowWrap: "anywhere",
                          wordWrap: "break-word",
                        }}
                      >
                        <table
                          role="presentation"
                          width="100%"
                          cellPadding="0"
                          cellSpacing="0"
                          style={{ tableLayout: "fixed", borderCollapse: "collapse", marginBottom: "8px" }}
                        >
                          <tbody>
                            <tr>
                              <td width="34" valign="top" style={{ paddingTop: "3px" }}>
                                {/* Plain raster image for email clients; adjacent text names the product. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={content.markUrl}
                                  alt=""
                                  width="26"
                                  height="26"
                                  style={{ display: "block", width: "26px", height: "26px", border: 0 }}
                                />
                              </td>
                              <td valign="top">
                                <p
                                  style={{
                                    margin: 0,
                                    fontFamily: displayFont,
                                    fontSize: "24px",
                                    lineHeight: "32px",
                                    fontWeight: 700,
                                    color: emailTokens.crimson,
                                  }}
                                >
                                  St. John Learning
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p
                          style={{
                            margin: 0,
                            color: emailTokens.secondary,
                            fontSize: "14px",
                            lineHeight: "22px",
                          }}
                        >
                          St. John Armenian Apostolic Church
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "28px 24px",
                          overflowWrap: "anywhere",
                          wordWrap: "break-word",
                        }}
                      >
                        <h1
                          style={{
                            margin: "0 0 20px",
                            fontFamily: displayFont,
                            fontSize: "28px",
                            lineHeight: "36px",
                            color: emailTokens.text,
                          }}
                        >
                          {content.heading}
                        </h1>
                        <p
                          style={{
                            margin: "0 0 20px",
                            padding: "12px 16px",
                            backgroundColor: emailTokens[content.tone],
                            color: emailTokens.text,
                          }}
                        >
                          {content.status}
                        </p>
                        {content.paragraphs.map((paragraph, index) => (
                          <p
                            key={index}
                            style={{
                              margin: "0 0 16px",
                              fontSize: "16px",
                              lineHeight: "26px",
                            }}
                          >
                            {paragraph}
                          </p>
                        ))}
                        <table
                          role="presentation"
                          cellPadding="0"
                          cellSpacing="0"
                          style={{
                            marginTop: "24px",
                            maxWidth: "100%",
                            borderCollapse: "collapse",
                          }}
                        >
                          <tbody>
                            <tr>
                              <td
                                align="center"
                                style={{
                                  backgroundColor: emailTokens.crimson,
                                  borderRadius: "4px",
                                  padding: "12px 20px",
                                }}
                              >
                                <a
                                  href={content.ctaUrl}
                                  style={{
                                    display: "inline-block",
                                    color: emailTokens.surface,
                                    fontSize: "16px",
                                    lineHeight: "24px",
                                    fontWeight: 700,
                                    textDecoration: "underline",
                                  }}
                                >
                                  {content.ctaLabel}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p
                          style={{
                            margin: "20px 0 0",
                            fontSize: "14px",
                            lineHeight: "22px",
                            color: emailTokens.secondary,
                          }}
                        >
                          You can also copy this link into your browser:
                          <br />
                          <a
                            href={content.ctaUrl}
                            style={{
                              color: emailTokens.crimson,
                              textDecoration: "underline",
                              wordBreak: "break-all",
                            }}
                          >
                            {content.ctaUrl}
                          </a>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "20px 24px",
                          borderTop: `1px solid ${emailTokens.border}`,
                          color: emailTokens.secondary,
                          fontSize: "14px",
                          lineHeight: "22px",
                          overflowWrap: "anywhere",
                          wordWrap: "break-word",
                        }}
                      >
                        <p style={{ margin: 0 }}>{footer}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
