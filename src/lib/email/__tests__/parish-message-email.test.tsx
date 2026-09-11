import { describe, expect, it } from "vitest";
import { buildParishMessageEmail } from "@/lib/email/build-transactional-email";

describe("buildParishMessageEmail", () => {
  it("uses the shared branding and preserves escaped subject, body and line breaks", async () => {
    const subject = "Parish news & <updates>";
    const body = 'Hello everyone,\r\n\r\nBring <script>alert("x")</script> & notes.\nThank you!';
    const message = await buildParishMessageEmail({
      subject,
      body,
      appUrl: "https://learning.example.com/nested",
    });
    const doc = new DOMParser().parseFromString(message.html, "text/html");
    expect(message.subject).toBe(subject);
    expect(doc.querySelector("h1")?.textContent).toBe(subject);
    expect(doc.querySelector("#email-card")).not.toBeNull();
    expect(doc.querySelector("script, updates")).toBeNull();
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.querySelector("img")?.getAttribute("src"))
      .toBe("https://learning.example.com/branding/st-john-learning-mark.png");
    const paragraph = Array.from(doc.querySelectorAll("p"))
      .find((element) => element.textContent?.startsWith("Hello everyone,"));
    expect(paragraph?.querySelectorAll("br")).toHaveLength(3);
    expect(paragraph?.textContent).toContain('<script>alert("x")</script> & notes.');
    for (const text of ["St. John Learning", "St. John Armenian Apostolic Church", subject]) {
      expect(doc.body.textContent).toContain(text);
      expect(message.text).toContain(text);
    }
    expect(message.text).toContain(body);
    expect(message.text).toContain("https://learning.example.com/app/dashboard");
    expect(message.text).not.toContain("<html");
  });
});
