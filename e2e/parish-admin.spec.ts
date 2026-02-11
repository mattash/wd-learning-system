import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const E2E_BASE_URL = "http://127.0.0.1:3100";
const E2E_PARISH_ID = "11111111-1111-4111-8111-111111111111";

test("parish admin participation watchlist supports filtering and csv export", async ({ context, page }, testInfo) => {
  await context.addCookies([
    { name: "e2e_onboarding_complete", value: "1", url: E2E_BASE_URL },
    { name: "active_parish_id", value: E2E_PARISH_ID, url: E2E_BASE_URL },
    { name: "e2e_role", value: "parish_admin", url: E2E_BASE_URL },
  ]);

  await page.goto("/app/parish-admin");
  await expect(page.getByRole("heading", { name: "Participation Watchlist" })).toBeVisible();

  const statusFilter = page
    .locator("select")
    .filter({ has: page.locator("option[value='completed']") })
    .first();

  await statusFilter.selectOption("completed");
  await expect(page.getByText("No learners match current filters.")).toBeVisible();

  const filteredDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const filteredDownload = await filteredDownloadPromise;
  const filteredPath = testInfo.outputPath("parish-participation-filtered.csv");
  await filteredDownload.saveAs(filteredPath);
  const filteredCsv = await readFile(filteredPath, "utf8");
  expect(filteredDownload.suggestedFilename()).toContain("parish-participation.csv");
  expect(filteredCsv).toContain("learner_name,learner_email");
  expect(filteredCsv).not.toContain("E2E User");

  await statusFilter.selectOption("not_started");
  await expect(page.getByRole("cell", { name: "E2E User", exact: true }).first()).toBeVisible();

  const exportDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const exportDownload = await exportDownloadPromise;
  const exportPath = testInfo.outputPath("parish-participation.csv");
  await exportDownload.saveAs(exportPath);
  const csv = await readFile(exportPath, "utf8");

  expect(csv).toContain("learner_name,learner_email");
  expect(csv).toContain("E2E User");
  expect(csv).toContain("Not started");
});
