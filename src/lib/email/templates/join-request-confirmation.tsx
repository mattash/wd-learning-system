import React from "react";

export interface JoinRequestConfirmationEmailProps {
  displayName: string;
  courseTitle: string;
  parishName: string;
  appUrl: string;
}

export default function JoinRequestConfirmationEmail({
  displayName,
  courseTitle,
  parishName,
  appUrl,
}: JoinRequestConfirmationEmailProps): React.ReactElement {
  const catalogUrl = `${appUrl}/app/catalog`;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        style={{
          backgroundColor: "#f6f9fc",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: "24px 0",
        }}
      >
        <table
          align="center"
          width="100%"
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e6ebf1",
          }}
        >
          <tr>
            <td style={{ padding: "40px 32px" }}>
              {/* ── Header ── */}
              <h1
                style={{
                  color: "#1a1a2e",
                  fontSize: "22px",
                  fontWeight: 600,
                  lineHeight: "28px",
                  margin: "0 0 24px 0",
                  textAlign: "center",
                }}
              >
                Enrollment Request Submitted
              </h1>

              {/* ── Body ── */}
              <p
                style={{
                  color: "#4a4a68",
                  fontSize: "15px",
                  lineHeight: "22px",
                  margin: "0 0 12px 0",
                }}
              >
                Hi {displayName},
              </p>
              <p
                style={{
                  color: "#4a4a68",
                  fontSize: "15px",
                  lineHeight: "22px",
                  margin: "0 0 12px 0",
                }}
              >
                Your request to enroll in <strong>{courseTitle}</strong> at{" "}
                <strong>{parishName}</strong> has been submitted for review.
              </p>
              <p
                style={{
                  color: "#4a4a68",
                  fontSize: "15px",
                  lineHeight: "22px",
                  margin: "0 0 24px 0",
                }}
              >
                A parish administrator will review your request. You will
                receive another email once your enrollment has been confirmed.
              </p>

              {/* ── Button ── */}
              <table align="center" style={{ marginBottom: "32px" }}>
                <tr>
                  <td
                    align="center"
                    style={{
                      backgroundColor: "#635bff",
                      borderRadius: "6px",
                    }}
                  >
                    <a
                      href={catalogUrl}
                      style={{
                        color: "#ffffff",
                        display: "inline-block",
                        fontSize: "14px",
                        fontWeight: 500,
                        lineHeight: "20px",
                        padding: "10px 20px",
                        textDecoration: "none",
                      }}
                    >
                      Browse More Courses
                    </a>
                  </td>
                </tr>
              </table>

              {/* ── Footer ── */}
              <div
                style={{
                  borderTop: "1px solid #e6ebf1",
                  paddingTop: "20px",
                }}
              >
                <p
                  style={{
                    color: "#8a8aa0",
                    fontSize: "13px",
                    lineHeight: "18px",
                    margin: 0,
                  }}
                >
                  If you have questions, please reach out to your parish
                  administrator. You can also visit the{" "}
                  <a
                    href={appUrl}
                    style={{ color: "#635bff", textDecoration: "underline" }}
                  >
                    learning dashboard
                  </a>
                  .
                </p>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
}
