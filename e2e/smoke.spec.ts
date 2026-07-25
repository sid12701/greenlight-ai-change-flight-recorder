import { test, expect } from "@playwright/test";

test("@smoke renders the changes overview shell", async ({ page }) => {
  await page.goto("/changes");
  // The shell renders regardless of how many changes exist. Use the page's
  // stable, user-facing h1 so this gate follows the redesigned interface.
  await expect(
    page.getByRole("heading", { name: "Every change. Every signal.", level: 1 }),
  ).toBeVisible();
});
