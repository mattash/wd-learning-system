import { expect, test } from "@playwright/test";

test("student onboarding through quiz submission", async ({ page }) => {
  await page.goto("/app/onboarding");

  await expect(
    page.getByRole("heading", { name: "Complete your profile" }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Display name" }).fill("E2E Student");
  await page.locator("form").getByLabel("Parish").selectOption("11111111-1111-4111-8111-111111111111");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.getByRole("link", { name: "Foundations of Parish Leadership" }).click();

  await expect(page).toHaveURL(/\/app\/courses\/22222222-2222-4222-8222-222222222222$/);
  await page.getByRole("link", { name: "Welcome Lesson" }).click();

  await expect(page).toHaveURL(/\/app\/lessons\/44444444-4444-4444-8444-444444444444$/);
  await expect(page.getByRole("heading", { name: "Welcome Lesson" })).toBeVisible();

  await page.getByRole("button", { name: "Scripture" }).click();
  await page.getByRole("button", { name: "Serve and learn" }).click();
  await page.getByRole("button", { name: "Submit answers" }).click();

  await expect(page.getByText("100%", { exact: true })).toBeVisible();
});
