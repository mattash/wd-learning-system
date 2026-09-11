import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const E2E_BASE_URL = "http://localhost:3100";
const E2E_PARISH_ID = "11111111-1111-4111-8111-111111111111";

test("parish admin participation watchlist supports filtering and csv export", async ({ context, page }, testInfo) => {
  await context.addCookies([
    { name: "e2e_onboarding_complete", value: "1", url: E2E_BASE_URL },
    { name: "active_parish_id", value: E2E_PARISH_ID, url: E2E_BASE_URL },
    { name: "e2e_role", value: "parish_admin", url: E2E_BASE_URL },
  ]);

  await page.goto("/app/parish-admin/participation");
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
  await expect(page.getByText("E2E User", { exact: true }).first()).toBeVisible();

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

test("communications picker supports keyboard selection and submits only confirmed recipients", async ({ context, page }, testInfo) => {
  await context.addCookies([
    { name: "e2e_onboarding_complete", value: "1", url: E2E_BASE_URL },
    { name: "active_parish_id", value: E2E_PARISH_ID, url: E2E_BASE_URL },
    { name: "e2e_role", value: "parish_admin", url: E2E_BASE_URL },
  ]);
  let payload: Record<string, unknown> | undefined;
  // Intercept the send completely: this test never invokes outbound delivery.
  await page.route("**/api/parish-admin/communications", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: { deliveryNote: "Test message logged." } });
  });
  await page.goto("/app/parish-admin/communications");
  await page.getByRole("combobox", { name: "Recipients", exact: true }).selectOption("specific_recipients");
  const dialog = page.getByRole("dialog", { name: "Choose specific recipients" });
  const search = dialog.getByLabel("Search students");
  await expect(search).toBeFocused();
  await search.fill("no matching student");
  await expect(dialog.getByText("No enrolled students match these filters.")).toBeVisible();
  await search.fill("E2E User");
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Filter by course")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("checkbox")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(dialog.getByRole("status")).toHaveText("1 selected · 1 shown");
  await page.screenshot({ path: testInfo.outputPath("recipient-picker.png") });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Confirm recipients" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "1 selected · Edit recipients" })).toBeFocused();
  await page.getByPlaceholder("Subject", { exact: true }).fill("Test subject");
  await page.getByPlaceholder("Message body").fill("Test body");
  await page.getByRole("button", { name: "Log message", exact: true }).click();
  await expect(page.getByText("Test message logged.")).toBeVisible();
  expect(payload).toEqual({ audienceType: "specific_recipients", recipientIds: ["e2e-user"], subject: "Test subject", body: "Test body" });
});
