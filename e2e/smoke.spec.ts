import { test, expect } from "@playwright/test";

test("@smoke renders the changes overview shell", async ({ page }) => {
  await page.goto("/changes");
  // The shell renders regardless of how many changes exist, so the smoke check
  // asserts the shell itself. Asserting the data states as alternatives made
  // this fail once the heading became unconditional and both matched.
  await expect(page.getByRole("heading", { name: "Changes", level: 1 })).toBeVisible();
});
