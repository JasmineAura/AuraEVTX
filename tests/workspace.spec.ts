import { test, expect } from "@playwright/test";
import { buildRecords } from "./support/records.mjs";

test("all categories remain accessible and ID search can escape unrelated filters", async ({
  page,
  context,
}) => {
  const base = buildRecords()[0];
  const categories = [
    "文件",
    "进程",
    "网络",
    "登录",
    "账户",
    "权限",
    "持久化",
    "脚本",
    "审计",
    "其他",
  ];
  const records = categories.map((category, i) => ({
    ...base,
    id: i + 1,
    event_id:
      category === "审计" ? 4719 : category === "其他" ? 65001 : 8000 + i,
    category,
    provider:
      category === "审计"
        ? "Microsoft-Windows-Security-Auditing"
        : "CustomProvider",
    channel: category === "审计" ? "Security" : "CustomChannel",
    operation: category === "审计" ? "系统审核策略变更" : "未收录释义",
    summary: "opaque",
    fields: { Note: "opaque" },
    xml: "<Event/>",
  }));
  await context.addInitScript((records) => {
    (window as any).__AURA_TEST_RECORDS__ = records;
  }, records);
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  await page.goto("/?window=events");
  await page.setViewportSize({ width: 1060, height: 720 });
  await expect(page.locator(".category-tabs button")).toHaveCount(11);
  for (const category of categories)
    await expect(
      page
        .locator(".category-tabs")
        .getByRole("button", { name: new RegExp(`^${category}`) }),
    ).toBeVisible();
  await page
    .locator(".category-tabs")
    .getByRole("button", { name: /^审计/ })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("4719");
  const search = page.getByRole("textbox", { name: "搜索事件", exact: true });
  await search.fill("65001");
  await expect(page.getByText("未找到匹配事件", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "在全部日志中搜索", exact: true })
    .click();
  await expect(search).toHaveValue("65001");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("65001");
  await search.fill(" 4719 ");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("系统审核策略变更");
  await search.fill("id:4719");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await search.fill("CustomChannel");
  await expect(page.locator("tbody tr")).toHaveCount(9);
  await search.fill("");
  await page
    .locator(".category-tabs")
    .getByRole("button", { name: /^其他/ })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("65001");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1060,
  );
  const atlas = await context.newPage();
  await atlas.goto("/?view=catalog");
  await atlas.getByRole("textbox", { name: "搜索事件图鉴" }).fill("4719");
  await expect(atlas.locator(".definition-card")).toHaveCount(1);
  await expect(atlas.locator(".definition-card")).toContainText(
    "系统审核策略变更",
  );
  await expect(atlas.locator(".definition-card")).toContainText(
    "AuditPolicyChanges",
  );
});

test("removing the last bookmark on a page returns to a populated page", async ({
  page,
  context,
}) => {
  const records = buildRecords();
  await context.addInitScript((records) => {
    (window as any).__AURA_TEST_RECORDS__ = records;
    localStorage.setItem(
      "aura-test-bookmarks",
      JSON.stringify(records.slice(0, 51).map((e) => e.id)),
    );
  }, records);
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  await page.goto(
    "/?window=events&filter=" +
      encodeURIComponent(JSON.stringify({ bookmarked: true })),
  );
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "取消收藏", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.locator(".pagination")).toContainText("1–50");
});

test("firewall atlas exposes the five provider-scoped event meanings", async ({
  page,
}) => {
  await page.goto("/?view=catalog");
  await page
    .getByRole("combobox", { name: "图鉴提供者" })
    .selectOption("Microsoft-Windows-Windows Firewall With Advanced Security");
  await expect(page.locator(".definition-card")).toHaveCount(5);
  for (const [id, title] of [
    [2004, "防火墙规则添加"],
    [2005, "防火墙规则修改"],
    [2006, "防火墙规则删除"],
    [2010, "网络接口配置文件变更"],
    [2033, "防火墙全部规则删除"],
  ] as const) {
    await page.getByRole("textbox", { name: "搜索事件图鉴" }).fill(String(id));
    await expect(page.locator(".definition-card")).toHaveCount(1);
    await expect(page.locator(".definition-card")).toContainText(title);
    await expect(page.locator(".definition-card")).toContainText("网络");
  }
});

test("unload sources with confirmation, clear stale detail and sync both windows", async ({
  page,
  context,
}) => {
  const first = buildRecords();
  const records = [
    ...first,
    ...first.map((e) => ({
      ...e,
      id: e.id + 10000,
      file_id: 2,
      source: "Other.evtx",
    })),
  ];
  await context.addInitScript((records) => {
    (window as any).__AURA_TEST_RECORDS__ = records;
  }, records);
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  await page.goto("/");
  await page.evaluate(
    (ids) => localStorage.setItem("aura-test-bookmarks", JSON.stringify(ids)),
    [first[0].id, first[0].id + 10000],
  );
  await expect(page.locator(".source-entry")).toHaveCount(2);
  await page
    .getByRole("button", { name: "卸载 Sysmon-Operational.evtx", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("原始 EVTX 文件会保留");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".source-entry")).toHaveCount(2);
  const popup = page.waitForEvent("popup");
  await page
    .locator(".source-item")
    .filter({ hasText: "Sysmon-Operational" })
    .click();
  const stream = await popup;
  await expect(stream.locator("tbody tr")).toHaveCount(50);
  await expect(stream.getByRole("combobox", { name: "日志来源" })).toHaveValue(
    "1",
  );
  await stream.locator("tbody tr").first().click();
  await expect(stream.locator(".detail-panel")).toBeVisible();
  await stream
    .getByRole("button", { name: "卸载当前日志", exact: true })
    .click();
  await stream.getByRole("button", { name: "确认卸载", exact: true }).click();
  await expect(stream.getByRole("dialog")).toHaveCount(0);
  await expect(stream.locator(".detail-panel")).not.toBeVisible();
  await expect(stream.locator(".explorer-layout")).not.toHaveClass(
    /has-detail/,
  );
  await expect(stream.getByRole("combobox", { name: "日志来源" })).toHaveValue(
    "",
  );
  await expect(page.locator(".source-entry")).toHaveCount(1);
  await expect(page.locator(".metric-value").first()).toHaveText("169EVENTS");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("aura-test-bookmarks")!),
    ),
  ).toEqual([first[0].id + 10000]);
  await expect(stream.locator(".pagination")).toContainText("169");
  await page.reload();
  await expect(page.locator(".source-entry")).toHaveCount(1);
  await page.getByRole("button", { name: "卸载日志", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "卸载日志", exact: true }).click();
  await page.getByRole("button", { name: "确认卸载", exact: true }).click();
  await expect(page.locator(".source-entry")).toHaveCount(0);
  await expect(page.locator(".metric-value").first()).toHaveText("0EVENTS");
  await expect(stream.locator("tbody tr")).toHaveCount(0);
  await expect(
    stream.getByRole("combobox", { name: "日志来源" }).locator("option"),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("aura-test-bookmarks")!),
    ),
  ).toEqual([]);
});

test("content rims contain long lists at normal and minimum window sizes", async ({
  page,
  context,
}) => {
  await context.addInitScript((records) => {
    (window as any).__AURA_TEST_RECORDS__ = records;
  }, buildRecords());
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  await page.goto("/");
  await expect(page.locator(".file-cards article")).toHaveCount(1);
  // Stress the layout with extra rows; source data and application logic stay untouched.
  await page.evaluate(() => {
    for (const selector of [
      ".top-types",
      ".distribution-list",
      ".file-cards",
    ]) {
      const list = document.querySelector(selector)!;
      for (let i = 0; i < 9; i++)
        list.appendChild(list.firstElementChild!.cloneNode(true));
    }
  });
  for (const width of [1512, 1060]) {
    await page.setViewportSize({ width, height: 960 });
    const problems = await page.evaluate(() => {
      const errors: string[] = [];
      for (const panel of document.querySelectorAll(
        ".overview-grid > .panel",
      )) {
        const rim = panel
          .querySelector(".orbit-frame-outline")!
          .getBoundingClientRect();
        const box = panel.getBoundingClientRect();
        if (
          Math.abs(rim.height - box.height + 2) > 1 ||
          Math.abs(rim.width - box.width + 2) > 1
        )
          errors.push("rim failed to resize");
        for (const item of panel.querySelectorAll(
          ".section-heading, .top-types > button, .distribution-list > button, .file-cards article",
        )) {
          const row = item.getBoundingClientRect();
          if (
            row.left < rim.left + 8 ||
            row.right > rim.right - 8 ||
            row.top < rim.top + 8 ||
            row.bottom > rim.bottom - 8
          )
            errors.push("content outside rim");
        }
      }
      return errors;
    });
    expect(problems).toEqual([]);
  }
});

test("orbital borders move and respect motion settings", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const traveler = page.locator(".orbit-frame-traveler").first();
  const offset = () =>
    traveler.evaluate((el) => getComputedStyle(el).strokeDashoffset);
  const start = await offset();
  await expect.poll(offset).not.toBe(start);
  await page.getByRole("button", { name: "外观设置", exact: true }).click();
  await page.getByRole("switch", { name: "界面动态" }).click();
  await page.getByRole("button", { name: /调查概览/ }).click();
  await expect(traveler).toHaveCSS("animation-name", "none");
  await expect(page.locator(".dial-rim-orbit").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.getByRole("button", { name: "外观设置", exact: true }).click();
  await page.getByRole("switch", { name: "界面动态" }).click();
  await page.getByRole("button", { name: /调查概览/ }).click();
  await expect(traveler).toHaveCSS("animation-name", "rim-journey");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(traveler).toHaveCSS("animation-name", "none");
  await expect(page.locator(".dial-rim-orbit").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

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
    page.getByRole("heading", { name: "Event Observatory", exact: true }),
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
  await expect(
    page.getByRole("button", { name: "日志起点", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "日志终点", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/样例|example/i)).toHaveCount(0);
  await page.getByRole("button", { name: "导入 EVTX", exact: false }).click();
  await expect(page.getByRole("alert")).toContainText(
    "文件导入需要 AuraEVTX 桌面应用",
  );
});

test("astral clock advances, pins evidence times, and converts the timezone", async ({
  page,
  context,
}) => {
  await context.addInitScript((records) => {
    (window as any).__AURA_TEST_RECORDS__ = records;
  }, buildRecords());
  await context.route("**/src/api.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export {api,native,streamWindow} from "/tests/support/browser-api.mjs";',
    }),
  );
  await page.clock.install({ time: new Date("2026-10-22T04:15:30Z") });
  await page.clock.pauseAt(new Date("2026-10-22T04:16:00Z"));
  await page.goto("/");
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "04:16:00",
  );
  await expect(page.getByTestId("clock-hour-hand")).toHaveAttribute(
    "data-angle",
    "128",
  );
  await page.clock.runFor(1000);
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "04:16:01",
  );
  await page.getByRole("button", { name: "日志起点", exact: true }).click();
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "02:10:00",
  );
  await page.clock.runFor(5000);
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "02:10:00",
  );
  await page.getByRole("button", { name: "日志终点", exact: true }).click();
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "02:11:24",
  );
  await page.getByRole("button", { name: "切换时钟时区", exact: true }).click();
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "10:11:24",
  );
  await expect(page.getByTestId("live-clock-digital")).toHaveText("12:16:06");
  await page.getByRole("button", { name: "实时", exact: true }).click();
  await expect(page.getByTestId("observatory-clock-digital")).toHaveText(
    "12:16:06",
  );
  await page.setViewportSize({ width: 1060, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1060,
  );
});
