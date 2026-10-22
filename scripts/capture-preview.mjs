import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { buildRecords } from "../tests/support/records.mjs";

// Inject demonstration events only into the screenshot browser, never into dist.
mkdirSync("docs/assets", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1060 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((records) => {
    window.__AURA_TEST_RECORDS__ = records;
    localStorage.setItem("aura-motion", "off");
  }, buildRecords());
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  const main = await context.newPage();
  await main.goto("http://127.0.0.1:1420", { waitUntil: "domcontentloaded" });
  await expect(
    main.locator(".metric").first().locator(".metric-value"),
  ).toHaveText("169EVENTS");
  await main.screenshot({ path: "docs/assets/overview.png", fullPage: true });
  const popup = main.waitForEvent("popup");
  await main
    .locator("nav")
    .getByRole("button", { name: /事件浏览器/ })
    .click();
  const stream = await popup;
  await stream.setViewportSize({ width: 1600, height: 1000 });
  await expect(stream.locator("tbody tr")).toHaveCount(50);
  await stream.screenshot({ path: "docs/assets/event-stream.png" });
  await stream.locator("tbody tr").first().click();
  await expect(stream.locator(".field-list")).toContainText("QueryName");
  await stream.screenshot({ path: "docs/assets/event-detail.png" });
  await stream
    .getByRole("button", { name: "切换明暗主题", exact: true })
    .click();
  await stream.screenshot({ path: "docs/assets/event-light.png" });
  await main.getByRole("button", { name: "外观设置", exact: true }).click();
  await main.getByRole("button", { name: "深色", exact: true }).click();
  await main.screenshot({ path: "docs/assets/themes.png", fullPage: true });
  console.log("Captured 5 demonstration screenshots in docs/assets.");
} finally {
  await browser.close();
}
