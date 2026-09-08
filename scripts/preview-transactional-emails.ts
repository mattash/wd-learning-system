// Local browser proof only: intercept remote assets; never send email.
// Run: node --import tsx scripts/preview-transactional-emails.ts
import React from "react";
import { render } from "@react-email/render";
import { chromium } from "@playwright/test";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createTransactionalContent, type TransactionalEmailType } from "../src/lib/email/transactional-content";
import { TransactionalEmail } from "../src/lib/email/transactional-email";

async function main() {
  const output = "/private/tmp/st-john-email-previews";
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage();
    const markUrl = "https://learning.example.com/branding/st-john-learning-mark.png";
    let blocked = false;
    await page.route("**/*", async (route) => {
      if (route.request().url() === markUrl && !blocked) {
        await route.fulfill({ path: "public/branding/st-john-learning-mark.png", contentType: "image/png" });
      } else {
        await route.abort();
      }
    });
    const types: TransactionalEmailType[] = ["admin-request", "submitted", "approved", "rejected", "enrolled", "completed"];
    for (const type of types) {
      for (const width of [320, 800]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const stress of [false, true]) {
          const content = createTransactionalContent(type, {
            displayName: stress ? "Ani".repeat(100) : "Ani",
            courseTitle: stress ? "Armenian".repeat(100) : "Armenian Basics",
            parishName: "St. John Armenian Apostolic Church",
            appUrl: "https://learning.example.com",
          });
          const html = await render(React.createElement(TransactionalEmail, { content }));
          for (const hideImages of [false, true]) {
            blocked = hideImages;
            await page.setContent(html, { waitUntil: "networkidle" });
            const result = await page.evaluate(() => ({
              fits: document.documentElement.scrollWidth <= window.innerWidth,
              markWidth: document.querySelector("img")?.getBoundingClientRect().width,
              naturalWidth: document.querySelector("img")?.naturalWidth,
              named: document.body.innerText.includes("St. John Learning"),
            }));
            if (!result.fits || !result.named || result.markWidth !== 26 || (!blocked && result.naturalWidth !== 104)) {
              throw new Error(`${type}/${width}/stress=${stress}/blocked=${blocked}: ${JSON.stringify(result)}`);
            }
            if (!stress && !blocked) {
              await writeFile(`${output}/${type}.html`, html);
              await page.screenshot({ path: `${output}/${type}-${width}.png`, fullPage: true });
            }
          }
        }
      }
    }
    // Exercise the MSO branch in Chrome with max-width removed. This checks
    // fallback geometry, not Word's rendering engine (which requires Outlook).
    for (const type of types) {
      const html = await render(React.createElement(TransactionalEmail, {
        content: createTransactionalContent(type, {
          courseTitle: "Armenian Basics",
          parishName: "St. John",
          appUrl: "https://learning.example.com",
        }),
      }));
      await page.setViewportSize({ width: 1200, height: 1000 });
      await page.setContent(html.replace(/<!--\[if mso\]>([\s\S]*?)<!\[endif\]-->/g, "$1"));
      const width = await page.locator("#email-card").evaluate((card) => {
        (card as HTMLElement).style.maxWidth = "none";
        return card.getBoundingClientRect().width;
      });
      if (width !== 600) throw new Error(`${type}: Outlook fallback width is ${width}`);
    }
    await copyFile(`${output}/submitted-320.png`, "docs/testing/email-branding/submitted-mobile.png");
    await copyFile(`${output}/approved-800.png`, "docs/testing/email-branding/approved-desktop.png");
    await copyFile(`${output}/admin-request-320.png`, "docs/testing/email-branding/admin-request-mobile.png");
    console.log(`48 responsive browser cases and six MSO fallback geometry checks passed. Previews: ${output}`);
  } finally {
    await browser.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
