// Test-only transport. This module is intercepted by Playwright, never imported by the app.
export const native = false;
export const streamWindow =
  new URLSearchParams(location.search).get("window") === "events";
const records = window.__AURA_TEST_RECORDS__ || [];
const marked = () =>
  new Set(JSON.parse(localStorage.getItem("aura-test-bookmarks") || "[]"));
const group = (values) =>
  Object.entries(
    values.reduce((a, key) => {
      a[key] = (a[key] || 0) + 1;
      return a;
    }, {}),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
function filtered(f) {
  return records
    .filter(
      (e) =>
        (!f.search ||
          JSON.stringify(e).toLowerCase().includes(f.search.toLowerCase())) &&
        (!f.provider || e.provider === f.provider) &&
        (f.event_id === null || e.event_id === f.event_id) &&
        (f.level === null || e.level === f.level) &&
        (f.file_id === null || e.file_id === f.file_id) &&
        (!f.category || e.category === f.category) &&
        (!f.bookmarked || marked().has(e.id)) &&
        (!f.from || e.time >= f.from) &&
        (!f.until || e.time <= f.until),
    )
    .sort(
      (a, b) =>
        (a.time.localeCompare(b.time) || a.id - b.id) * (f.ascending ? 1 : -1),
    );
}
export async function api(command, args = {}) {
  if (command === "query_events") {
    const all = filtered(args.filter);
    return {
      rows: all
        .slice(
          args.filter.page * args.filter.page_size,
          (args.filter.page + 1) * args.filter.page_size,
        )
        .map((e) => ({ ...e, bookmarked: marked().has(e.id) })),
      total: all.length,
    };
  }
  if (command === "get_event") {
    const e = records.find((e) => e.id === args.id);
    return { ...e, bookmarked: marked().has(e.id) };
  }
  if (command === "set_bookmark") {
    const marks = marked();
    if (args.enabled) marks.add(args.id);
    else marks.delete(args.id);
    localStorage.setItem("aura-test-bookmarks", JSON.stringify([...marks]));
    return;
  }
  if (command === "get_stats") {
    const rows = [...records].sort((a, b) => a.time.localeCompare(b.time));
    const types = Object.values(
      rows.reduce((a, e) => {
        const k = `${e.provider}/${e.channel}/${e.event_id}`;
        a[k] ??= {
          provider: e.provider,
          channel: e.channel,
          event_id: e.event_id,
          operation: e.operation,
          category: e.category,
          count: 0,
        };
        a[k].count++;
        return a;
      }, {}),
    ).sort((a, b) => b.count - a.count);
    return {
      total: rows.length,
      bookmarks: rows.filter((e) => marked().has(e.id)).length,
      computers: new Set(rows.map((e) => e.computer)).size,
      first: rows[0]?.time ?? null,
      last: rows.at(-1)?.time ?? null,
      files: rows.length
        ? [
            {
              id: 1,
              name: "Sysmon-Operational.evtx",
              path: "C:\\Evidence\\Sysmon-Operational.evtx",
              hash: window.__AURA_TEST_HASH__ || "a".repeat(64),
              count: rows.length,
              errors: 0,
            },
          ]
        : [],
      providers: group(rows.map((e) => e.provider)),
      categories: group(rows.map((e) => e.category)),
      levels: group(rows.map((e) => String(e.level))),
      timeline: group(rows.map((e) => e.time.slice(0, 19))).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      types,
    };
  }
  throw new Error("请使用桌面应用执行文件操作。");
}
