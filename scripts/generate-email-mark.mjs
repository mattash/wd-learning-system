// Rasterize the exact 26px navigation mark at 4x density. No AI-generated artwork.
// Run: node scripts/generate-email-mark.mjs (requires installed Chrome).
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104" viewBox="0 0 26 26">
<rect width="26" height="26" rx="5" fill="#870024"/>
<svg x="6" y="6" width="14" height="14" viewBox="0 0 20 20">
<path d="M10 1v18M1 10h18M6 6l-3-3M14 6l3-3M6 14l-3 3M14 14l3 3" fill="none" stroke="white" stroke-linecap="round" stroke-width="2"/>
</svg></svg>`;
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  const png = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 104;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  }, svg);
  await mkdir(new URL("../public/branding/", import.meta.url), { recursive: true });
  await writeFile(new URL("../public/branding/st-john-learning-mark.png", import.meta.url), Buffer.from(png, "base64"));
} finally {
  await browser.close();
}
