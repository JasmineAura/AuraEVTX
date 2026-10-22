import { test, expect } from "@playwright/test";
import { buildRecords } from "./support/records.mjs";

test("independent stream window, full-width list, filters, detail and synchronized themes", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  await context.addInitScript((records) => {
    (window as any).__AURA_TEST_RECORDS__ = records;
  }, buildRecords());
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "CASE OVERVIEW", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("载入真实样例")).toHaveCount(0);
  const popupPromise = page.waitForEvent("popup");
  await page
    .locator("nav")
    .getByRole("button", { name: /事件浏览器/ })
    .click();
  const stream = await popupPromise;
  await stream.setViewportSize({ width: 1512, height: 960 });
  await expect(stream.locator("tbody tr")).toHaveCount(50);
  await expect(stream.locator(".sidebar")).not.toBeVisible();
  await expect(stream.locator(".page-hero")).not.toBeVisible();
  expect(
    (await stream.locator(".events-panel").boundingBox())!.width,
  ).toBeGreaterThan(1450);
  await stream.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(stream.locator(".pagination")).toContainText("51–100");
  await stream.getByRole("button", { name: "第一页", exact: true }).click();
  await stream.locator("tbody tr").first().click();
  await expect(stream.locator(".detail-panel")).toContainText("DNS 查询");
  await expect(stream.locator(".field-list")).toContainText("QueryName");
  await stream.getByRole("button", { name: "原始 XML", exact: true }).click();
  await expect(stream.locator(".xml-view")).toContainText("<Event");
  await stream.getByRole("button", { name: "事件字段", exact: false }).click();
  await stream
    .getByRole("button", { name: "收藏当前事件", exact: true })
    .click();
  await stream.getByRole("button", { name: "仅看收藏", exact: true }).click();
  await expect(stream.locator("tbody tr")).toHaveCount(1);
  await stream
    .getByRole("button", { name: "显示全部事件", exact: true })
    .click();
  await stream
    .getByRole("button", { name: "关闭事件详情", exact: true })
    .click();
  expect(
    (await stream.locator(".events-panel").boundingBox())!.width,
  ).toBeGreaterThan(1450);
  await stream
    .getByRole("textbox", { name: "搜索事件", exact: true })
    .fill("Collect.ps1");
  await expect(stream.locator("tbody tr")).toHaveCount(6);
  await stream.getByRole("button", { name: "清除搜索", exact: true }).click();
  await stream.getByRole("button", { name: "筛选", exact: true }).click();
  await stream.getByRole("spinbutton", { name: "筛选事件 ID" }).fill("1");
  await expect(stream.locator("tbody tr")).toHaveCount(6);
  await stream.getByRole("button", { name: "重置筛选", exact: false }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: /事件 ID 图鉴/ })
    .click();
  await page.getByRole("textbox", { name: "搜索事件图鉴" }).fill("4624");
  await expect(page.locator(".definition-card")).toHaveCount(1);
  await expect(page.locator(".definition-card")).toContainText("账户登录成功");
  await page.getByRole("button", { name: "外观设置", exact: true }).click();
  await page.getByRole("button", { name: /深海青/ }).click();
  await expect(stream.locator("html")).toHaveAttribute("data-theme", "ocean");
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  await expect(stream.locator("html")).toHaveAttribute("data-mode", "light");
  await page.getByRole("switch", { name: "界面动态" }).click();
  await expect(stream.locator("html")).toHaveAttribute("data-motion", "off");
  await stream.setViewportSize({ width: 1060, height: 720 });
  expect(
    await stream.evaluate(() => document.documentElement.scrollWidth),
  ).toBe(1060);
  await stream.close();
  expect(errors).toEqual([]);
});

test("production browser contains no bundled sample or demo transport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".metric").first().locator(".metric-value"),
  ).toHaveText("0EVENTS");
  await expect(page.getByText(/样例|example/i)).toHaveCount(0);
  await page.getByRole("button", { name: "导入 EVTX", exact: false }).click();
  await expect(page.getByRole("alert")).toContainText(
    "文件导入需要 AuraEVTX 桌面应用",
  );
});
