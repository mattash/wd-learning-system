import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@react-email/render";
import { buildTransactionalEmail } from "../build-transactional-email";
import {
  createTransactionalContent,
  type TransactionalEmailType,
} from "../transactional-content";
import { emailTokens } from "../transactional-email";
import JoinRequestConfirmationEmail from "../templates/join-request-confirmation";

const params = {
  displayName: "Ani",
  courseTitle: "Armenian Basics",
  parishName: "St. John",
  appUrl: "https://learning.example.com/",
};
const cases: [
  TransactionalEmailType,
  string,
  string,
  string,
  string,
  string,
][] = [
  [
    "admin-request",
    "New enrollment request for Armenian Basics",
    "New Enrollment Request",
    "Action needed: review a new enrollment request for Armenian Basics.",
    "Review Enrollment Requests",
    "/app/parish-admin/join-requests",
  ],
  [
    "submitted",
    "Your enrollment request for Armenian Basics has been submitted",
    "Enrollment Request Submitted",
    "Your request for Armenian Basics is awaiting parish review.",
    "Browse More Courses",
    "/app/catalog",
  ],
  [
    "approved",
    "Your enrollment in Armenian Basics is confirmed",
    "Enrollment Request Approved",
    "Your enrollment in Armenian Basics is confirmed. Start learning in your dashboard.",
    "Open Your Learning Dashboard",
    "/app/dashboard",
  ],
  [
    "rejected",
    "Update on your Armenian Basics enrollment request",
    "Enrollment Request Update",
    "There is an update on your request to join Armenian Basics.",
    "Browse Available Courses",
    "/app/catalog",
  ],
  [
    "enrolled",
    "You've been enrolled in Armenian Basics",
    "Enrollment Confirmed",
    "A parish administrator has enrolled you in Armenian Basics.",
    "Open Your Learning Dashboard",
    "/app/dashboard",
  ],
  [
    "completed",
    "You've completed Armenian Basics!",
    "Course Completed",
    "Congratulations on completing Armenian Basics!",
    "View Your Learning Dashboard",
    "/app/dashboard",
  ],
];

afterEach(() => vi.unstubAllEnvs());

describe("transactional emails", () => {
  it.each(cases)(
    "brands %s with semantic HTML and equivalent text",
    async (type, subject, heading, preheader, label, path) => {
      const message = await buildTransactionalEmail(type, params);
      const doc = new DOMParser().parseFromString(message.html, "text/html");
      const content = createTransactionalContent(type, params);
      expect(message.subject).toBe(subject);
      const mark = doc.querySelector("img");
      expect(doc.querySelectorAll("img")).toHaveLength(1);
      expect(mark?.getAttribute("src")).toBe("https://learning.example.com/branding/st-john-learning-mark.png");
      expect(mark?.getAttribute("alt")).toBe("");
      expect(mark?.getAttribute("width")).toBe("26");
      expect(mark?.getAttribute("height")).toBe("26");
      expect(mark?.closest("tr")?.textContent).toContain("St. John Learning");
      mark?.remove();
      expect(doc.body.textContent).toContain("St. John Learning");
      expect(message.text).not.toContain("/branding/");
      expect(message.html).toMatch(/^<!DOCTYPE html PUBLIC/);
      expect(doc.documentElement.lang).toBe("en");
      expect(doc.querySelectorAll("h1")).toHaveLength(1);
      expect(doc.querySelector("h1")?.textContent).toBe(heading);
      expect(doc.querySelector("[aria-hidden=true]")?.textContent).toBe(
        preheader,
      );
      expect(
        doc.querySelector("[aria-hidden=true]")?.getAttribute("style"),
      ).toContain("display:none");
      expect(doc.querySelectorAll("table").length).toBeGreaterThan(1);
      doc
        .querySelectorAll("table")
        .forEach((table) =>
          expect(table.getAttribute("role")).toBe("presentation"),
        );
      expect(doc.querySelector("a")?.textContent).toBe(label);
      doc
        .querySelectorAll("a")
        .forEach((link) =>
          expect(link.getAttribute("href")).toBe(
            `https://learning.example.com${path}`,
          ),
        );
      for (const text of [
        "St. John Learning",
        "St. John Armenian Apostolic Church",
        heading,
        content.status,
        ...content.paragraphs,
      ]) {
        expect(doc.body.textContent).toContain(text);
        expect(message.text).toContain(text);
      }
      expect(message.text).toContain(
        `${label}: https://learning.example.com${path}`,
      );
      expect(message.text).not.toMatch(/<\/?(?:html|table|p|a)[ >]/);
      expect(message.html).toContain("font-size:16px");
      expect(message.html).toContain("max-width:600px");
      expect(message.html).toContain("overflow-wrap:anywhere");
      expect(message.html).toContain("Georgia");
      expect(message.html).not.toMatch(
        /#635bff|Western Diocese|oklch|var\(--|gradient|<script|<svg|class=|fonts\.google/i,
      );
    },
  );

  it.each(cases)("provides an Outlook-only fixed card width for %s", async (type) => {
    const { html } = await buildTransactionalEmail(type, params);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const card = doc.querySelector("#email-card");
    expect(card?.tagName).toBe("TABLE");
    expect(card?.getAttribute("width")).toBe("100%");
    expect(card?.getAttribute("style")).toContain("max-width:600px");
    // Modern clients must not receive the fixed-width override.
    expect(doc.querySelector("style")).toBeNull();
    const conditional = html.match(/<!--\[if mso\]>([\s\S]*?)<!\[endif\]-->/g);
    expect(conditional).toHaveLength(1);
    expect(conditional?.[0]).toContain("#email-card { width: 600px !important; }");
    const outlook = new DOMParser().parseFromString(
      html.replace(/<!--\[if mso\]>([\s\S]*?)<!\[endif\]-->/g, "$1"),
      "text/html",
    );
    expect(outlook.head.querySelector("style")?.textContent)
      .toBe("#email-card { width: 600px !important; }");
    expect(outlook.querySelectorAll("#email-card")).toHaveLength(1);
  });

  it.each(cases)("escapes untrusted fields in %s", async (type) => {
    const attack = '<img src=x onerror="alert(1)"> & <script>bad()</script>';
    const message = await buildTransactionalEmail(type, {
      ...params,
      displayName: attack,
      courseTitle: attack,
      parishName: attack,
    });
    const doc = new DOMParser().parseFromString(message.html, "text/html");
    expect(doc.querySelector("script, [onerror]")).toBeNull();
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.body.textContent).toContain(attack);
    expect(message.text).toContain(attack);
    expect(message.html).toContain("&lt;img");
  });

  it("keeps the legacy React template on the shared layout", async () => {
    expect(await render(JoinRequestConfirmationEmail(params))).toBe(
      (await buildTransactionalEmail("submitted", params)).html,
    );
  });

  it("handles missing names and long unbroken titles", async () => {
    const message = await buildTransactionalEmail("submitted", {
      ...params,
      displayName: undefined,
      courseTitle: "A".repeat(1000),
    });
    expect(message.text).not.toContain("Hi undefined");
    expect(message.text).toContain("A".repeat(1000));
    expect(message.html).toContain("word-wrap:break-word");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://user:pass@example.com",
    "not a URL",
  ])("rejects unsafe application URL %s", async (appUrl) => {
    await expect(
      buildTransactionalEmail("approved", { ...params, appUrl }),
    ).rejects.toThrow();
  });

  it("resolves configured, preview and local URL fallbacks", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_APP_URL",
      "https://configured.example.com/path?q=x#hash",
    );
    expect(
      createTransactionalContent("approved", { ...params, appUrl: undefined })
        .ctaUrl,
    ).toBe("https://configured.example.com/app/dashboard");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    vi.stubEnv("VERCEL_URL", "preview.example.com");
    expect(
      createTransactionalContent("approved", { ...params, appUrl: undefined })
        .ctaUrl,
    ).toBe("https://preview.example.com/app/dashboard");
    vi.stubEnv("VERCEL_URL", undefined);
    expect(
      createTransactionalContent("approved", { ...params, appUrl: undefined })
        .ctaUrl,
    ).toBe("http://localhost:3000/app/dashboard");
  });

  it.each([
    ["https://learning.example.com/nested?redirect=https://evil.example#hash", "https://learning.example.com"],
    ["http://localhost:3000/path", "https://localhost:3000"],
    ["http://learning.example.com/path", "https://learning.example.com"],
  ])("uses only the validated origin for the HTTPS mark: %s", (appUrl, origin) => {
    expect(createTransactionalContent("submitted", { ...params, appUrl }).markUrl)
      .toBe(`${origin}/branding/st-john-learning-mark.png`);
  });

  it("ships a lightweight 4x PNG derived from the exact shared navigation mark", () => {
    const png = readFileSync("public/branding/st-john-learning-mark.png");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(104);
    expect(png.readUInt32BE(20)).toBe(104);
    expect(png.length).toBeLessThan(5000);
    const generator = readFileSync("scripts/generate-email-mark.mjs", "utf8");
    const path = "M10 1v18M1 10h18M6 6l-3-3M14 6l3-3M6 14l-3 3M14 14l3 3";
    expect(generator).toContain(path);
    for (const header of ["app-header-client", "public-learning-header"]) {
      expect(readFileSync(`src/components/${header}.tsx`, "utf8")).toContain(path);
    }
  });

  it("freezes the required palette and meets AA text contrast", () => {
    expect(Object.isFrozen(emailTokens)).toBe(true);
    expect(emailTokens).toMatchObject({
      crimson: "#870024",
      gold: "#be7c1c",
      background: "#f3f6fa",
      surface: "#ffffff",
      text: "#0d151b",
      secondary: "#474e54",
      border: "#dbe0e5",
    });
    const luminance = (hex: string) => {
      const channels = [1, 3, 5]
        .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    for (const [foreground, background] of [
      [emailTokens.surface, emailTokens.crimson],
      [emailTokens.crimson, emailTokens.surface],
      [emailTokens.secondary, emailTokens.surface],
      [emailTokens.text, emailTokens.surface],
      ...[emailTokens.pending, emailTokens.success, emailTokens.neutral].map(
        (bg) => [emailTokens.text, bg],
      ),
    ]) {
      const [a, b] = [luminance(foreground), luminance(background)].sort(
        (x, y) => y - x,
      );
      expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
