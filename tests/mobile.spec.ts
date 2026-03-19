import { test, expect } from "@playwright/test";

test.describe("Home Page - Mobile Responsiveness", () => {
  test("renders without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize();
    expect(bodyBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Body should not be wider than viewport
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test("header renders correctly", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByText("Ahura AI")).toBeVisible();
  });

  test("topic input is visible and usable", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("What do you want to learn today?");
    await expect(input).toBeVisible();
    await input.fill("TypeScript");
    await expect(input).toHaveValue("TypeScript");
  });

  test("start learning button works", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("What do you want to learn today?");
    await input.fill("TypeScript");
    await page.getByRole("button", { name: "Start Learning" }).click();
    await page.waitForURL(/\/learn\?topic=TypeScript/);
    expect(page.url()).toContain("/learn?topic=TypeScript");
  });

  test("topic cards are visible and tappable", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("button", {
      hasText: "Machine Learning Fundamentals",
    });
    await expect(cards).toBeVisible();
    await cards.click();
    await page.waitForURL(/\/learn\?topic=/);
  });

  test("all topic cards are visible (none cut off)", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator("text=Quantum Computing");
    await expect(cards).toBeVisible();
    const cybersecurity = page.locator("text=Cybersecurity Essentials");
    await expect(cybersecurity).toBeVisible();
  });
});

test.describe("Learn Page - Mobile Responsiveness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/learn?topic=TypeScript");
  });

  test("page loads without horizontal overflow", async ({ page }) => {
    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    const viewport = page.viewportSize();
    expect(bodyBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(bodyBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  });

  test("header is visible with topic name", async ({ page }) => {
    await expect(page.getByText("TypeScript")).toBeVisible();
  });

  test("back button is visible and works", async ({ page }) => {
    const backBtn = page.getByLabel("Go back");
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await page.waitForURL("/");
  });

  test("message input is visible at bottom", async ({ page }) => {
    const input = page.getByPlaceholder("Ask a question...");
    await expect(input).toBeVisible();
    // Should be near the bottom of the viewport
    const box = await input.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.y).toBeGreaterThan(viewport!.height * 0.5);
  });

  test("send button is visible", async ({ page }) => {
    const sendBtn = page.getByLabel("Send message");
    await expect(sendBtn).toBeVisible();
  });

  test("dashboard button is visible on mobile", async ({ page, browserName }, testInfo) => {
    // Only test on mobile projects
    const isMobile = testInfo.project.name.includes("mobile") || testInfo.project.name.includes("tablet");
    if (!isMobile) {
      test.skip();
      return;
    }
    // On mobile, the button should show "Camera" text
    const dashBtn = page.getByLabel("Toggle emotion dashboard");
    await expect(dashBtn).toBeVisible();
  });
});

test.describe("Learn Page - Mobile Dashboard Drawer", () => {
  test("dashboard drawer opens on mobile", async ({ page, browserName }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile") || testInfo.project.name.includes("tablet");
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto("/learn?topic=TypeScript");

    // Tap the dashboard button
    const dashBtn = page.getByLabel("Toggle emotion dashboard");
    await dashBtn.click();

    // Drawer should appear — look for the drawer container (fixed overlay with the title)
    const drawer = page.locator(".fixed.inset-0.z-50");
    await expect(drawer).toBeVisible();

    // Camera enable button should be visible in the drawer
    await expect(drawer.getByText("Enable Camera")).toBeVisible();
  });

  test("dashboard drawer closes on backdrop tap", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes("mobile") || testInfo.project.name.includes("tablet");
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto("/learn?topic=TypeScript");

    const dashBtn = page.getByLabel("Toggle emotion dashboard");
    await dashBtn.click();

    const drawer = page.locator(".fixed.inset-0.z-50");
    await expect(drawer).toBeVisible();

    // Close by tapping the backdrop
    await page.locator(".fixed.inset-0.z-50 > .absolute.inset-0.bg-black\\/60").click({ position: { x: 10, y: 10 } });
    await expect(drawer).not.toBeVisible();
  });

  test("desktop sidebar is visible on large screens", async ({ page }, testInfo) => {
    const isDesktop = testInfo.project.name.includes("desktop");
    if (!isDesktop) {
      test.skip();
      return;
    }

    await page.goto("/learn?topic=TypeScript");

    // On desktop, sidebar should be visible
    await expect(page.getByText("Enable Camera")).toBeVisible();
    // The text "Enable your camera to see real-time emotion analytics" from the dashboard
    await expect(
      page.getByText("Enable your camera to see real-time emotion analytics")
    ).toBeVisible();
  });
});

test.describe("Navigation - All viewports", () => {
  test("can navigate from home to learn and back", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder("What do you want to learn today?");
    await input.fill("React");
    await page.getByRole("button", { name: "Start Learning" }).click();
    await page.waitForURL(/\/learn\?topic=React/);

    // Go back
    await page.getByLabel("Go back").click();
    await page.waitForURL("/");
    await expect(page.locator("header").getByText("Ahura AI")).toBeVisible();
  });
});

test.describe("Content does not overflow on small screens", () => {
  test("no element exceeds viewport width", async ({ page }) => {
    await page.goto("/");
    const viewport = page.viewportSize()!;

    // Check a few key containers
    const containers = page.locator("main > div");
    const count = await containers.count();

    for (let i = 0; i < count; i++) {
      const box = await containers.nth(i).boundingBox();
      if (box) {
        expect(
          box.x + box.width,
          `Container ${i} overflows viewport`
        ).toBeLessThanOrEqual(viewport.width + 5);
      }
    }
  });
});
