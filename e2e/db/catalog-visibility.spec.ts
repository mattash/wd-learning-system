import { expect, test } from "@playwright/test";

const PARISH_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_COURSE_ID = "88888888-8888-4888-8888-888888888888";
const COURSE_ID = "22222222-2222-4222-8222-222222222222";
const PRIVATE_COURSE_ID = "99999999-9999-4999-8999-999999999999";

// Auth is bypassed (E2E_AUTH_BYPASS), but parish scope and roles still come
// from the real database, so we must select the parish the seeded
// "e2e-user" is a member of.
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "active_parish_id", value: PARISH_ID, url: "http://localhost:3101" },
  ]);
});

test("catalog lists only parish-visible courses", async ({ page }) => {
  await page.goto("/app/catalog");
  await expect(page.getByRole("heading", { name: "Course Catalog" })).toBeVisible();

  // PARISH course adopted by Saint Mark.
  await expect(
    page.getByRole("link", { name: "Foundations of Parish Leadership" }).first(),
  ).toBeVisible();

  // PARISH course adopted only by Holy Cross must not leak to a Saint Mark member.
  await expect(page.getByText("Holy Cross Private Course")).toHaveCount(0);
});

test("unjoined course card navigates to the preview route", async ({ page }) => {
  await page.goto("/app/catalog");
  await page.getByRole("link", { name: "Foundations of Parish Leadership" }).first().click();

  await expect(page).toHaveURL(new RegExp(`/app/courses/${COURSE_ID}/preview$`));
  await expect(page.getByRole("heading", { name: "Foundations of Parish Leadership" })).toBeVisible();
  await expect(page.getByText("Orientation")).toBeVisible();
  await expect(page.getByText("Welcome Lesson")).toBeVisible();
});

test("preview of a course outside the parish returns 404", async ({ page }) => {
  const response = await page.goto(`/app/courses/${PRIVATE_COURSE_ID}/preview`);
  expect(response?.status()).toBe(404);
});

test("preview shows Request sent for a course with a pending join request", async ({ page }) => {
  await page.goto(`/app/courses/${PENDING_COURSE_ID}/preview`);

  await expect(
    page.getByRole("heading", { name: "Parish Leadership in Practice" }),
  ).toBeVisible();
  await expect(page.getByText("Request sent", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request to Join" }),
  ).toHaveCount(0);
});

test("preview still offers to join when the pending request is for another course", async ({ page }) => {
  await page.goto(`/app/courses/${COURSE_ID}/preview`);

  await expect(
    page.getByRole("heading", { name: "Foundations of Parish Leadership" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request to Join" }),
  ).toBeVisible();
});
