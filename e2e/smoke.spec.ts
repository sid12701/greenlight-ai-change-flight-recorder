import { test, expect } from "@playwright/test";

test("@smoke renders the changes overview shell", async ({ page }) => {
  await page.goto("/changes");
  await expect(
    page.getByRole("heading", { name: "Changes" }).or(page.getByText("No changes recorded yet.")),
  ).toBeVisible();
});
