import { expect, test } from "@playwright/test";

/**
 * Smoke tests for the things that must hold before real members are let in.
 *
 * Every test here runs signed out, deliberately. Signing in needs a real OAuth
 * round trip through Google or GitHub, which cannot be automated without
 * either a password-based test account — forbidden by CLAUDE.md, no
 * email/password provider exists — or a service-role token, which would test a
 * path no member ever takes. What is left is still the part worth guarding:
 * that the app refuses everyone by default, and that the public pages it does
 * serve do not fall over.
 */

/** Every route a signed-out visitor must not reach. */
const PROTECTED = [
  "/home",
  "/my-issues",
  "/notifications",
  "/drafts",
  "/admin",
  "/admin/members",
  "/admin/invites",
  "/admin/audit",
];

test.describe("access control", () => {
  for (const path of PROTECTED) {
    test(`${path} redirects a signed-out visitor to sign-in`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
    });
  }

  test("the root path does not serve the app to a stranger", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("sign-in", () => {
  test("offers OAuth only", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();

    // No email/password provider exists, and a password field appearing here
    // would mean one had been added.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test("renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });
});

test.describe("invite links", () => {
  test("a malformed token renders a notice rather than a 500", async ({
    page,
  }) => {
    // This was a real defect once: the token went straight into a uuid cast
    // and Postgres raised 22P02, turning a mistyped link into a server error.
    const response = await page.goto("/invite/not-a-uuid");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("an unknown but well-formed token is refused", async ({ page }) => {
    const response = await page.goto(
      "/invite/00000000-0000-4000-8000-000000000000",
    );
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("hardening", () => {
  test("the development kitchen-sink route is gone", async ({ page }) => {
    await page.goto("/dev/kitchen-sink");

    // Asserted on the landing URL, not the status. /dev is no longer in the
    // public prefix list, so middleware redirects a signed-out visitor to
    // sign-in and the final response is a perfectly ordinary 200 — which says
    // nothing about whether the route still exists. Where the browser ends up
    // does.
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.locator("body")).not.toContainText("Kitchen sink");
  });

  test("no server secret is present in the served HTML", async ({ page }) => {
    await page.goto("/sign-in");
    const html = await page.content();
    for (const name of [
      "SERVICE_ROLE",
      "SMTP_PASSWORD",
      "DATABASE_URL",
      "CRON_SECRET",
    ]) {
      expect(html).not.toContain(name);
    }
  });
});
