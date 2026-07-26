import { expect, test } from "@playwright/test";

test("landing page loads primary hero copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /alera/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
});

test("login page renders sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
