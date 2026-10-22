import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileSearch,
  FileUp,
  FolderOpen,
  Layers3,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Monitor,
  PanelsTopLeft,
  Moon,
  Palette,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Terminal,
  X,
  LogOut,
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { api, native, streamWindow } from "./api";
import { emptyStats, initialFilter, levels } from "./types";
import type {
  Definition,
  Detail,
  EventRow,
  Filter,
  ImportReport,
  Page,
  Progress,
  Stats,
  SourceFile,
} from "./types";
import catalogData from "../shared/catalog.json";
import OrbitFrame, { DialRim } from "./components/OrbitFrame";
import UnloadDialog from "./components/UnloadDialog";
import AstralClock, {
  ClockReadout,
  OrbitMark,
  StarMap,
} from "./components/AstralClock";
const catalog: Definition[] = catalogData;
type View = "events" | "overview" | "catalog" | "bookmarks" | "settings";
const themes = [
  {
    id: "midnight",
    name: "午夜蓝",
    subtitle: "MIDNIGHT / BLUE × GOLD",
    colors: ["#1635a3", "#f1ce54"],
  },
  {
    id: "ocean",
    name: "深海青",
    subtitle: "ABYSS / TEAL × AMBER",
    colors: ["#087c8b", "#ffc56b"],
  },
  {
    id: "violet",
    name: "暮光紫",
    subtitle: "TWILIGHT / VIOLET × SILVER",
    colors: ["#7152c5", "#c9d6fa"],
  },
];
const titles: Record<View, [string, string, string]> = {
  events: [
    "EVENT EXPLORER",
    "事件，皆有迹可循。",
    "从每一条记录，接近事件的全貌。",
  ],
  overview: [
    "Event Observatory",
    "事件观测台",
    "以时间为坐标，追踪每一条线索。",
  ],
  catalog: [
    "Event Atlas",
    "读懂每一个事件 ID。",
    "按提供者与通道区分释义，让分析有据可依。",
  ],
  bookmarks: [
    "EVIDENCE BOARD",
    "把关键证据，留在眼前。",
    "收藏的重要事件，始终可追溯至原始记录。",
  ],
  settings: [
    "Your Constellation",
    "你的工作台，你的节奏。",
    "配色、明暗与动态，让专注更进一步。",
  ],
};
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
function displayTime(value: string | null, utc: boolean, date = true) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    ...(date ? { year: "numeric", month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(utc ? { timeZone: "UTC" } : {}),
  }).format(d);
}
function operationDef(e: Pick<EventRow, "provider" | "channel" | "event_id">) {
  return catalog.find(
    (d) =>
      d.provider.toLowerCase() === e.provider.toLowerCase() &&
      d.channel.toLowerCase() === e.channel.toLowerCase() &&
      d.id === e.event_id,
  );
}
function shortProvider(p: string) {
  return p.replace(/^Microsoft-Windows-/, "");
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    if (streamWindow) return "events";
    const requested = new URLSearchParams(location.search).get("view");
    return requested && ["catalog", "settings"].includes(requested)
      ? (requested as View)
      : "overview";
  });
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage] = useState<Page>({ rows: [], total: 0 });
  const [selected, setSelected] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"fields" | "xml">("fields");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("aura-theme") || "midnight",
  );
  const [mode, setMode] = useState(
    () => localStorage.getItem("aura-mode") || "dark",
  );
  const [motion, setMotion] = useState(
    () => localStorage.getItem("aura-motion") !== "off",
  );
  const [utc, setUtc] = useState(
    () => localStorage.getItem("aura-time") !== "local",
  );
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogProvider, setCatalogProvider] = useState("");
  const [onlyPresent, setOnlyPresent] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [unloadTarget, setUnloadTarget] = useState<SourceFile | null>(null);
  const [unloading, setUnloading] = useState(false);
  const unloadGuard = useRef(false);
  const importGuard = useRef(false);
  const detailSequence = useRef(0);
  const statsSequence = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aura-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem("aura-mode", mode);
  }, [mode]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "on" : "off";
    localStorage.setItem("aura-motion", motion ? "on" : "off");
  }, [motion]);
  useEffect(() => {
    localStorage.setItem("aura-time", utc ? "utc" : "local");
  }, [utc]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const updateFilter = useCallback(
    (patch: Partial<Filter>) =>
      setFilter((f) => ({ ...f, ...patch, page: patch.page ?? 0 })),
    [],
  );
  const refresh = useCallback(async () => {
    const sequence = ++statsSequence.current;
    const next = await api<Stats>("get_stats");
    if (sequence !== statsSequence.current) return;
    setStats(next);
    setFilter((current) =>
      current.file_id !== null &&
      !next.files.some((f) => f.id === current.file_id)
        ? { ...current, file_id: null, page: 0 }
        : current,
    );
    setSelected((current) =>
      current && !next.files.some((f) => f.id === current.file_id)
        ? null
        : current,
    );
  }, []);
  const applyUnloaded = useCallback((fileId: number) => {
    ++statsSequence.current;
    ++detailSequence.current;
    setSelected((current) => (current?.file_id === fileId ? null : current));
    setPage({ rows: [], total: 0 });
    setFilter((current) => ({
      ...current,
      file_id: current.file_id === fileId ? null : current.file_id,
      page: 0,
    }));
    setUnloadTarget((current) => (current?.id === fileId ? null : current));
  }, []);
  const unloadFile = useCallback(async () => {
    if (!unloadTarget || unloadGuard.current) return;
    unloadGuard.current = true;
    setUnloading(true);
    setError("");
    const target = unloadTarget;
    try {
      await api<number>("unload_file", { fileId: target.id });
      applyUnloaded(target.id);
      if (!native)
        localStorage.setItem(
          "aura-workspace-unloaded",
          JSON.stringify({ id: target.id, nonce: Date.now() }),
        );
      await refresh();
      setNotice(`已卸载 ${target.name}，原始文件已保留`);
    } catch (e) {
      setError(String(e));
    } finally {
      unloadGuard.current = false;
      setUnloading(false);
    }
  }, [unloadTarget, applyUnloaded, refresh]);
  const openStream = useCallback(async (nextFilter: Filter) => {
    try {
      if (native) await api("open_event_window", { filter: nextFilter });
      else {
        const url = new URL(location.pathname, location.origin);
        url.searchParams.set("window", "events");
        url.searchParams.set("filter", JSON.stringify(nextFilter));
        if (
          !window.open(
            url,
            "aura-event-stream",
            "popup=yes,width=1600,height=1000",
          )
        )
          throw new Error("请允许打开独立事件窗口。");
      }
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "aura-theme") setTheme(event.newValue || "midnight");
      if (event.key === "aura-mode") setMode(event.newValue || "dark");
      if (event.key === "aura-motion") setMotion(event.newValue !== "off");
      if (event.key === "aura-time") setUtc(event.newValue !== "local");
      if (
        !native &&
        event.key === "aura-workspace-unloaded" &&
        event.newValue
      ) {
        applyUnloaded(JSON.parse(event.newValue).id);
        void refresh().catch((e) => setError(String(e)));
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [applyUnloaded, refresh]);
  useEffect(() => {
    const apply = (next: Filter) => {
      setView(next.bookmarked ? "bookmarks" : "events");
      setFilter({ ...initialFilter, ...next });
      setSearch(next.search || "");
      setSelected(null);
    };
    if (streamWindow) {
      if (native)
        api<Filter>("get_stream_filter")
          .then(apply)
          .catch((e) => setError(String(e)));
      else {
        try {
          const value = new URLSearchParams(location.search).get("filter");
          if (value) apply(JSON.parse(value));
        } catch {
          setError("筛选参数无效，已使用默认条件。");
        }
      }
    }
    if (!native) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const add = (cleanup: () => void) =>
      disposed ? cleanup() : cleanups.push(cleanup);
    const window = getCurrentWebviewWindow();
    if (streamWindow) {
      window
        .listen<Filter>("stream-navigate", (e) => apply(e.payload))
        .then(add)
        .catch((e) => setError(String(e)));
    } else {
      window
        .listen<View>("main-navigate", (e) => setView(e.payload))
        .then(add)
        .catch((e) => setError(String(e)));
    }
    listen<string>("workspace-changed", (e) => {
      if (e.payload.startsWith("unload:"))
        applyUnloaded(Number(e.payload.slice(7)));
      if (e.payload === "import") {
        setImporting(false);
        setProgress(null);
      }
      void refresh().catch((e) => setError(String(e)));
    })
      .then(add)
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [refresh, applyUnloaded]);
  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, [refresh]);
  useEffect(() => {
    const t = setTimeout(
      () =>
        setFilter((current) =>
          current.search === search ? current : { ...current, search, page: 0 },
        ),
      220,
    );
    return () => clearTimeout(t);
  }, [search]);
  const activeFilter = useMemo(
    () => ({ ...filter, bookmarked: view === "bookmarks" }),
    [filter, view],
  );
  useEffect(() => {
    if (view !== "events" && view !== "bookmarks") return;
    let live = true;
    setLoading(true);
    api<Page>("query_events", { filter: activeFilter })
      .then((p) => {
        if (live) setPage(p);
      })
      .catch((e) => {
        if (live) setError(String(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [activeFilter, stats, view]);
  const selectEvent = useCallback(async (e: EventRow) => {
    const sequence = ++detailSequence.current;
    setFieldSearch("");
    try {
      const d = await api<Detail>("get_event", { id: e.id });
      if (sequence === detailSequence.current) setSelected(d);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  const doImport = useCallback(
    async (paths: string[]) => {
      if (importGuard.current) return;
      importGuard.current = true;
      setImporting(true);
      setError("");
      setReport(null);
      setProgress(null);
      try {
        const r = await api<ImportReport>("import_files", { paths });
        setReport(r);
        await refresh();
        setView(streamWindow ? "events" : "overview");
        setFilter(initialFilter);
        setSearch("");
        if (!streamWindow && (r.imported || r.skipped))
          await openStream(initialFilter);
      } catch (e) {
        setError(String(e));
      } finally {
        importGuard.current = false;
        setImporting(false);
        setProgress(null);
      }
    },
    [refresh, openStream],
  );
  const chooseFiles = useCallback(
    async (folder = false) => {
      try {
        if (!native) {
          setError("文件导入需要 AuraEVTX 桌面应用，请下载 Windows 发行版。");
          return;
        }
        const paths = await open({
          multiple: !folder,
          directory: folder,
          filters: folder
            ? undefined
            : [{ name: "Windows Event Log", extensions: ["evtx"] }],
        });
        if (paths) await doImport(Array.isArray(paths) ? paths : [paths]);
      } catch (e) {
        setError(String(e));
      }
    },
    [doImport],
  );
  useEffect(() => {
    if (!native) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const add = (unlisten: () => void) => {
      if (disposed) unlisten();
      else cleanups.push(unlisten);
    };
    listen<Progress>("import-progress", (e) => {
      setProgress(e.payload);
      setImporting(true);
    })
      .then(add)
      .catch((e) => setError(String(e)));
    getCurrentWebview()
      .onDragDropEvent((e) => {
        setDragging(e.payload.type === "over" || e.payload.type === "enter");
        if (e.payload.type === "drop") void doImport(e.payload.paths);
      })
      .then(add)
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, [doImport]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (streamWindow)
          requestAnimationFrame(() => searchRef.current?.focus());
        else void openStream(initialFilter);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        void chooseFiles();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setError("");
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [chooseFiles, openStream]);
  async function toggleBookmark(e: EventRow) {
    try {
      await api("set_bookmark", { id: e.id, enabled: !e.bookmarked });
      if (selected?.id === e.id)
        setSelected({ ...selected, bookmarked: !e.bookmarked });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("已复制到剪贴板");
    } catch {
      setError("无法访问剪贴板，请手动选中内容复制。");
    }
  }
  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      if (!native) throw new Error("请在桌面应用中导出 CSV。");
      const path = await save({
        defaultPath: `AuraEVTX-${Date.now()}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (path) {
        const n = await api<number>("export_csv", {
          path,
          filter: activeFilter,
        });
        setNotice(`已导出 ${fmt(n)} 条事件`);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(false);
    }
  }
  function navigate(next: View) {
    if (!streamWindow && (next === "events" || next === "bookmarks")) {
      void openStream({ ...initialFilter, bookmarked: next === "bookmarks" });
      return;
    }
    if (streamWindow && next !== "events" && next !== "bookmarks") {
      if (native)
        void api("focus_main", { view: next }).catch((e) =>
          setError(String(e)),
        );
      else {
        const url = new URL(location.pathname, location.origin);
        url.searchParams.set("view", next);
        window.open(url, "aura-main");
      }
      return;
    }
    setView(next);
    updateFilter({ page: 0 });
  }
  function followReference(
    url: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) {
    if (!native) return;
    event.preventDefault();
    void api("open_reference", { url }).catch((e) => setError(String(e)));
  }
  function pivot(patch: Partial<Filter>) {
    if (!streamWindow) {
      void openStream({ ...initialFilter, ...patch });
      return;
    }
    setView("events");
    setSearch("");
    setFilter({ ...initialFilter, ...patch });
  }
  const present = useMemo(
    () =>
      new Map(
        stats.types.map((t) => [
          `${t.provider.toLowerCase()}|${t.channel.toLowerCase()}|${t.event_id}`,
          t.count,
        ]),
      ),
    [stats.types],
  );
  const dictionary = useMemo(() => {
    const rows = catalog.map((d) => ({
      ...d,
      count:
        present.get(
          `${d.provider.toLowerCase()}|${d.channel.toLowerCase()}|${d.id}`,
        ) || 0,
      known: true,
    }));
    for (const t of stats.types)
      if (!operationDef(t))
        rows.push({
          provider: t.provider,
          channel: t.channel,
          id: t.event_id,
          title: t.operation,
          category: t.category,
          description:
            "内置字典暂未收录此提供者、通道与事件 ID 的释义。请查看原始字段，并参考相应提供者文档。",
          source: "",
          count: t.count,
          known: false,
        });
    return rows.filter(
      (d) =>
        (!catalogProvider || d.provider === catalogProvider) &&
        (!onlyPresent || d.count > 0) &&
        (!catalogSearch ||
          `${d.id} ${d.title} ${d.category} ${d.provider} ${d.description}`
            .toLowerCase()
            .includes(catalogSearch.toLowerCase())),
    );
  }, [stats.types, present, catalogSearch, catalogProvider, onlyPresent]);
  const currentDefinition = selected ? operationDef(selected) : undefined;
  const maxTimeline = Math.max(1, ...stats.timeline.map((b) => b.count));
  const filterCount = [
    filter.provider,
    filter.event_id !== null,
    filter.level !== null,
    filter.file_id !== null,
    filter.category,
    filter.from,
    filter.until,
  ].filter(Boolean).length;
  const reset = () => {
    setFilter(initialFilter);
    setSearch("");
  };
  return (
    <div className={`app-shell ${streamWindow ? "stream-window" : ""}`}>
      <StarMap />
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="AuraEVTX 首页"
        >
          <OrbitMark />
          <span>
            AURA<span className="brand-evtx">EVTX</span>
            <small>EVENT OBSERVATORY</small>
          </span>
        </button>
        <div className="sidebar-label">
          OBSERVATORY <span>01 / 04</span>
        </div>
        <nav>
          {(
            [
              {
                id: "overview",
                icon: LayoutDashboard,
                label: "调查概览",
                en: "OVERVIEW",
              },
              {
                id: "events",
                icon: FileSearch,
                label: "事件浏览器",
                en: "EXPLORER",
              },
              {
                id: "catalog",
                icon: BookOpen,
                label: "事件 ID 图鉴",
                en: "EVENT ATLAS",
              },
              {
                id: "bookmarks",
                icon: Bookmark,
                label: "证据收藏",
                en: "EVIDENCE",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>
                {item.label}
                <small>{item.en}</small>
              </span>
              {item.id === "bookmarks" && stats.bookmarks > 0 ? (
                <em>{stats.bookmarks}</em>
              ) : view === item.id ? (
                <ArrowRight size={15} />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">
          EVIDENCE SOURCES{" "}
          <span>{String(stats.files.length).padStart(2, "0")}</span>
        </div>
        <button
          className={`source-all ${filter.file_id === null ? "chosen" : ""}`}
          onClick={() => pivot({})}
        >
          <Layers3 size={15} />
          <span>全部日志</span>
          <b>{fmt(stats.total)}</b>
        </button>
        <div className="source-list">
          {stats.files.map((f) => (
            <div className="source-entry" key={f.id}>
              <button
                title={`${f.path}\nSHA-256: ${f.hash || "未提供"}`}
                className={`source-item ${filter.file_id === f.id ? "chosen" : ""}`}
                onClick={() => pivot({ file_id: f.id })}
              >
                <FileCode2 size={15} />
                <span>
                  {f.name.replace(/\.evtx$/i, "")}
                  <small>
                    {fmt(f.count)} EVENTS{" "}
                    {f.errors > 0 ? `· ${f.errors} ERRORS` : ""}
                  </small>
                </span>
                <span className="source-dot" />
              </button>
              <button
                className="source-unload"
                aria-label={`卸载 ${f.name}`}
                title="卸载日志，保留原始文件"
                disabled={importing || unloading}
                onClick={() => setUnloadTarget(f)}
              >
                <LogOut size={14} />
              </button>
            </div>
          ))}
          {!stats.files.length && (
            <div className="no-source">
              尚未载入日志
              <br />
              <span>导入文件，开始调查</span>
            </div>
          )}
        </div>
        <button
          className="add-source"
          onClick={() => chooseFiles(true)}
          disabled={importing}
        >
          <FolderOpen size={15} />
          添加日志目录
          <ArrowRight size={14} />
        </button>
        <div className="sidebar-bottom">
          <div className="engine-card">
            <span className="live-dot" />
            <div>
              LOCAL-FIRST ENGINE<small>离线分析 · 数据留在本机</small>
            </div>
            <ShieldCheck size={19} />
          </div>
          <button
            className={`settings-nav ${view === "settings" ? "chosen" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={17} />
            外观与设置<span>v0.3.2</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{streamWindow ? "EVENT STREAM" : "AURA OBSERVATORY"}</span>
            <ChevronRight size={12} />
            <b>{streamWindow ? "独立事件流" : "本地证据档案"}</b>
            <span className="workspace-badge">
              {native ? "DESKTOP" : "WEB PREVIEW"}
            </span>
          </div>
          <div className="top-actions">
            <ClockReadout
              utc={utc}
              onToggle={() => setUtc((value) => !value)}
            />
            {streamWindow && (
              <>
                <button
                  className="small-button stream-main-button"
                  onClick={() => navigate("overview")}
                >
                  <PanelsTopLeft size={16} />
                  返回主窗口
                </button>
                <button
                  className="small-button"
                  onClick={() => {
                    setView((v) =>
                      v === "bookmarks" ? "events" : "bookmarks",
                    );
                    updateFilter({ page: 0 });
                  }}
                >
                  <Bookmark size={15} />
                  {view === "bookmarks" ? "显示全部事件" : "仅看收藏"}
                </button>
                <button
                  className="primary-button stream-import"
                  disabled={importing}
                  onClick={() => chooseFiles()}
                >
                  <FileUp size={15} />
                  导入 EVTX
                </button>
              </>
            )}
            <span className="engine-status">
              <span className="live-dot" />
              引擎就绪
            </span>
            <span className="vertical-divider" />
            <button
              className="icon-button"
              title="切换明暗主题"
              aria-label="切换明暗主题"
              onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
            >
              {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              title="外观设置"
              aria-label="外观设置"
              onClick={() => navigate("settings")}
            >
              <Palette size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <section className="page-hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span />
                WINDOWS EVENT ARCHIVE <i>✦</i>{" "}
                {String(
                  [
                    "overview",
                    "events",
                    "catalog",
                    "bookmarks",
                    "settings",
                  ].indexOf(view) + 1,
                ).padStart(2, "0")}
              </div>
              <h1 key={view}>{titles[view][0]}</h1>
              <div className="hero-sub">
                <h2>{titles[view][1]}</h2>
                <p>{titles[view][2]}</p>
              </div>
            </div>
            <div className="hero-right">
              <AstralClock
                utc={utc}
                first={stats.first}
                last={stats.last}
                onToggle={() => setUtc((value) => !value)}
              />
              <div className="hero-tools">
                <button
                  className="primary-button"
                  onClick={() => chooseFiles()}
                  disabled={importing}
                >
                  {importing ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <FileUp size={17} />
                  )}
                  <span>{importing ? "正在导入" : "导入 EVTX"}</span>
                  <span className="button-arrow">
                    <ArrowRight size={18} />
                  </span>
                </button>
                {!streamWindow && (
                  <button
                    className="text-button"
                    onClick={() => navigate("events")}
                  >
                    <PanelsTopLeft size={13} />
                    打开独立事件窗口
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </section>
          {error && (
            <div className="alert error" role="alert">
              <CircleHelp size={17} />
              <span>{error}</span>
              <button aria-label="关闭错误" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {report && (
            <div className={`alert ${report.errors ? "warning" : "success"}`}>
              <Check size={17} />
              <div>
                {report.cancelled
                  ? "导入已取消，当前未完成文件已回滚。"
                  : "导入完成。"}{" "}
                新增 {report.imported} 个文件 / {fmt(report.records)}{" "}
                条事件，跳过 {report.skipped} 个重复文件，{report.errors}{" "}
                个错误。
                {report.messages.length > 0 && (
                  <details>
                    <summary>查看错误详情（最多 30 条）</summary>
                    {report.messages.map((m, i) => (
                      <p key={i}>{m}</p>
                    ))}
                  </details>
                )}
              </div>
              <button aria-label="关闭导入报告" onClick={() => setReport(null)}>
                <X size={16} />
              </button>
            </div>
          )}
          {importing && (
            <div className="import-progress">
              <div>
                <LoaderCircle size={17} className="spin" />
                <b>{progress?.stage || "准备导入"}</b>
                <span>
                  {progress
                    ? `${progress.file_index}/${progress.file_total} · ${progress.file} · ${fmt(progress.records)} 条事件`
                    : "正在读取 EVTX 文件"}
                </span>
                <button
                  onClick={() =>
                    api("cancel_import").catch((e) => setError(String(e)))
                  }
                >
                  取消导入
                </button>
              </div>
              <div className="progress-track">
                <i
                  style={{
                    width: progress
                      ? `${Math.max(5, ((progress.file_index - 1) / progress.file_total) * 100)}%`
                      : "5%",
                  }}
                />
              </div>
            </div>
          )}
          <section className="metric-strip">
            <Metric
              icon={Database}
              label="事件总数"
              en="TOTAL EVENTS"
              value={fmt(stats.total)}
              note={`${stats.files.length} 个日志文件`}
            />
            <Metric
              icon={Layers3}
              label="事件类型"
              en="EVENT TYPES"
              value={fmt(stats.types.length)}
              note={`${stats.providers.length} 个事件提供者`}
            />
            <Metric
              icon={Monitor}
              label="主机数量"
              en="HOSTS"
              value={String(stats.computers).padStart(2, "0")}
              note="按计算机名称聚合"
            />
            <Metric
              icon={Clock3}
              label="证据时间范围"
              en={utc ? "TIME RANGE / UTC" : "TIME RANGE / LOCAL"}
              value={
                stats.first ? displayTime(stats.first, utc, false) : "— : — : —"
              }
              note={
                stats.last
                  ? `至 ${displayTime(stats.last, utc)}`
                  : "等待导入日志"
              }
              wide
            />
          </section>
          {(view === "events" || view === "bookmarks") && (
            <section
              className={`explorer-layout ${selected ? "has-detail" : ""}`}
            >
              <div className="events-panel panel">
                <div className="section-heading">
                  <div>
                    <span className="section-index">
                      {view === "bookmarks" ? "04" : "02"}
                    </span>
                    <h3>{view === "bookmarks" ? "证据收藏" : "事件流"}</h3>
                    <span className="count-badge">{fmt(page.total)}</span>
                    {streamWindow && (
                      <select
                        className="stream-source-select"
                        aria-label="日志来源"
                        value={filter.file_id ?? ""}
                        onChange={(e) =>
                          updateFilter({
                            file_id:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">全部日志来源</option>
                        {stats.files.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    {streamWindow && filter.file_id !== null && (
                      <button
                        className="small-button"
                        disabled={importing || unloading}
                        onClick={() =>
                          setUnloadTarget(
                            stats.files.find((f) => f.id === filter.file_id) ??
                              null,
                          )
                        }
                      >
                        <LogOut size={14} />
                        卸载当前日志
                      </button>
                    )}
                    <button
                      className={`small-button ${advanced ? "selected" : ""}`}
                      onClick={() => setAdvanced(!advanced)}
                    >
                      <SlidersHorizontal size={14} />
                      筛选{filterCount > 0 && <em>{filterCount}</em>}
                    </button>
                    <button
                      className="small-button"
                      onClick={exportCsv}
                      disabled={exporting || page.total === 0}
                    >
                      {exporting ? (
                        <LoaderCircle size={14} className="spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      导出
                    </button>
                  </div>
                </div>
                <div className="search-toolbar">
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      aria-label="搜索事件"
                      placeholder="搜索进程、IP、用户、路径或任意字段…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search ? (
                      <button
                        className="clear-search"
                        aria-label="清除搜索"
                        onClick={() => setSearch("")}
                      >
                        <X size={13} />
                      </button>
                    ) : (
                      <kbd>Ctrl K</kbd>
                    )}
                  </div>
                  <button
                    className="sort-button"
                    onClick={() =>
                      updateFilter({ ascending: !filter.ascending })
                    }
                    title="切换时间排序"
                  >
                    <ArrowDownUp size={15} />
                    <span>{filter.ascending ? "最早优先" : "最新优先"}</span>
                  </button>
                </div>
                <div className="category-tabs">
                  <button
                    className={!filter.category ? "active" : ""}
                    onClick={() => updateFilter({ category: "" })}
                  >
                    全部事件
                  </button>
                  {stats.categories.slice(0, 6).map((c) => (
                    <button
                      key={c.name}
                      className={filter.category === c.name ? "active" : ""}
                      onClick={() => updateFilter({ category: c.name })}
                    >
                      {c.name}
                      <span>{c.count}</span>
                    </button>
                  ))}
                </div>
                {advanced && (
                  <div className="advanced-filters">
                    <label>
                      事件提供者
                      <select
                        value={filter.provider}
                        onChange={(e) =>
                          updateFilter({ provider: e.target.value })
                        }
                      >
                        <option value="">全部提供者</option>
                        {stats.providers.map((p) => (
                          <option key={p.name} value={p.name}>
                            {shortProvider(p.name)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      事件 ID
                      <input
                        aria-label="筛选事件 ID"
                        type="number"
                        min="0"
                        max="65535"
                        placeholder="例如 4624"
                        value={filter.event_id ?? ""}
                        onChange={(e) =>
                          updateFilter({
                            event_id:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      日志级别
                      <select
                        value={filter.level ?? ""}
                        onChange={(e) =>
                          updateFilter({
                            level:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">全部级别</option>
                        {Object.entries(levels).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name} ({id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      起始时间（UTC）
                      <input
                        type="datetime-local"
                        step="1"
                        value={filter.from.slice(0, 19)}
                        onChange={(e) =>
                          updateFilter({
                            from: e.target.value
                              ? `${e.target.value}.000000000Z`
                              : "",
                          })
                        }
                      />
                    </label>
                    <label>
                      结束时间（UTC）
                      <input
                        type="datetime-local"
                        step="1"
                        value={filter.until.slice(0, 19)}
                        onChange={(e) =>
                          updateFilter({
                            until: e.target.value
                              ? `${e.target.value}.999999999Z`
                              : "",
                          })
                        }
                      />
                    </label>
                    <button className="text-button" onClick={reset}>
                      重置筛选 <X size={13} />
                    </button>
                  </div>
                )}
                {filterCount > 0 && !advanced && (
                  <div className="filter-hint">
                    <ListFilter size={13} />
                    已应用 {filterCount} 项筛选
                    <button onClick={reset}>清除全部</button>
                  </div>
                )}
                <div
                  className={`event-table-wrap ${loading ? "is-loading" : ""}`}
                >
                  <table className="event-table">
                    <thead>
                      <tr>
                        <th className="bookmark-col">
                          <Bookmark size={12} />
                        </th>
                        <th>
                          时间 <small>{utc ? "UTC" : "LOCAL"}</small>
                        </th>
                        <th>事件 ID</th>
                        <th>操作 / 行为</th>
                        <th>主机 / 提供者</th>
                        <th>级别</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {page.rows.map((e) => (
                        <tr
                          key={e.id}
                          className={
                            selected?.id === e.id ? "selected-row" : ""
                          }
                          onClick={() => selectEvent(e)}
                          tabIndex={0}
                          onKeyDown={(k) => {
                            if (k.key === "Enter") void selectEvent(e);
                          }}
                          aria-label={`事件 ${e.event_id} ${e.operation}`}
                        >
                          <td>
                            <button
                              className={`row-bookmark ${e.bookmarked ? "marked" : ""}`}
                              aria-label={
                                e.bookmarked ? "取消收藏" : "收藏事件"
                              }
                              onClick={(ev) => {
                                ev.stopPropagation();
                                void toggleBookmark(e);
                              }}
                            >
                              <Bookmark
                                size={14}
                                fill={e.bookmarked ? "currentColor" : "none"}
                              />
                            </button>
                          </td>
                          <td className="time-cell">
                            <b>{displayTime(e.time, utc, false)}</b>
                            <small>
                              {displayTime(e.time, utc).split(" ")[0]}
                            </small>
                          </td>
                          <td>
                            <span className={`event-id cat-${e.category}`}>
                              {e.event_id}
                            </span>
                          </td>
                          <td className="operation-cell">
                            <strong>{e.operation}</strong>
                            <span title={e.summary}>
                              {e.summary || e.channel}
                            </span>
                          </td>
                          <td className="host-cell">
                            <span>{e.computer || "未知主机"}</span>
                            <small title={e.provider}>
                              {shortProvider(e.provider)}
                            </small>
                          </td>
                          <td>
                            <span className={`level-badge level-${e.level}`}>
                              <i />
                              {levels[e.level] || `级别 ${e.level}`}
                            </span>
                          </td>
                          <td>
                            <ChevronRight size={14} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!page.rows.length && (
                    <div className="empty-state">
                      <div className="empty-emblem">
                        <FileSearch size={33} />
                        <span />
                      </div>
                      <span className="eyebrow">
                        {stats.total
                          ? "NO MATCHING RECORDS"
                          : "READY TO INVESTIGATE"}
                      </span>
                      <h3>
                        {stats.total
                          ? view === "bookmarks"
                            ? "尚无符合条件的收藏"
                            : "未找到匹配事件"
                          : "让调查，从一份日志开始。"}
                      </h3>
                      <p>
                        {stats.total
                          ? "调整筛选条件，或点击事件旁的书签保存证据。"
                          : "拖入任意提供者的 EVTX，或导入整个目录。"}
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => (stats.total ? reset() : chooseFiles())}
                      >
                        {stats.total ? (
                          <ListFilter size={16} />
                        ) : (
                          <FileUp size={16} />
                        )}
                        <span>
                          {stats.total ? "重置筛选" : "选择 EVTX 文件"}
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="pagination">
                  <span>
                    {page.total
                      ? `${fmt(filter.page * filter.page_size + 1)}–${fmt(Math.min((filter.page + 1) * filter.page_size, page.total))}`
                      : "0"}{" "}
                    <i>/</i> 共 {fmt(page.total)} 条
                  </span>
                  <div>
                    <select
                      aria-label="每页条数"
                      value={filter.page_size}
                      onChange={(e) =>
                        updateFilter({ page_size: Number(e.target.value) })
                      }
                    >
                      {[25, 50, 100, 200].map((n) => (
                        <option key={n} value={n}>
                          {n} 条 / 页
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="第一页"
                      disabled={filter.page === 0}
                      onClick={() => updateFilter({ page: 0 })}
                    >
                      <ChevronsLeft size={15} />
                    </button>
                    <button
                      aria-label="上一页"
                      disabled={filter.page === 0}
                      onClick={() => updateFilter({ page: filter.page - 1 })}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <b>
                      {filter.page + 1}
                      <span>
                        {" "}
                        /{" "}
                        {Math.max(1, Math.ceil(page.total / filter.page_size))}
                      </span>
                    </b>
                    <button
                      aria-label="下一页"
                      disabled={
                        (filter.page + 1) * filter.page_size >= page.total
                      }
                      onClick={() => updateFilter({ page: filter.page + 1 })}
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button
                      aria-label="最后一页"
                      disabled={
                        (filter.page + 1) * filter.page_size >= page.total
                      }
                      onClick={() =>
                        updateFilter({
                          page: Math.max(
                            0,
                            Math.ceil(page.total / filter.page_size) - 1,
                          ),
                        })
                      }
                    >
                      <ChevronsRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <aside className="detail-panel panel">
                <div className="section-heading">
                  <div>
                    <span className="section-index">INSPECT</span>
                    <h3>事件详情</h3>
                  </div>
                  {selected && (
                    <button
                      className="icon-button"
                      aria-label="关闭事件详情"
                      onClick={() => {
                        detailSequence.current++;
                        setSelected(null);
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {selected ? (
                  <>
                    <div className="detail-intro">
                      <div className="detail-id-line">
                        <span className="detail-id">{selected.event_id}</span>
                        <span className="detail-category">
                          {selected.category}
                          <small>EVENT ID</small>
                        </span>
                        <button
                          className={`icon-button ${selected.bookmarked ? "marked" : ""}`}
                          aria-label="收藏当前事件"
                          onClick={() => toggleBookmark(selected)}
                        >
                          <Bookmark
                            size={19}
                            fill={selected.bookmarked ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                      <h3>{selected.operation}</h3>
                      <p>
                        {currentDefinition?.description ||
                          "此事件尚未收录中文释义。完整字段和原始 XML 可用于分析，不影响导入。"}
                      </p>
                      {currentDefinition && (
                        <a
                          className="definition-source"
                          href={currentDefinition.source}
                          onClick={(event) =>
                            followReference(currentDefinition.source, event)
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          提供者文档 <ExternalLink size={11} />
                        </a>
                      )}
                      <div className="detail-facts">
                        <span>
                          时间
                          <b>
                            {displayTime(selected.time, utc)} {utc ? "UTC" : ""}
                          </b>
                        </span>
                        <span>
                          记录 ID<b>#{selected.record_id}</b>
                        </span>
                        <span>
                          主机<b>{selected.computer || "—"}</b>
                        </span>
                        <span>
                          提供者<b>{selected.provider}</b>
                        </span>
                        <span>
                          日志通道<b>{selected.channel}</b>
                        </span>
                        <span>
                          源文件<b title={selected.source}>{selected.source}</b>
                        </span>
                      </div>
                    </div>
                    <div className="detail-tabs">
                      <button
                        className={tab === "fields" ? "active" : ""}
                        onClick={() => setTab("fields")}
                      >
                        事件字段{" "}
                        <span>{Object.keys(selected.fields).length}</span>
                      </button>
                      <button
                        className={tab === "xml" ? "active" : ""}
                        onClick={() => setTab("xml")}
                      >
                        原始 XML
                      </button>
                      <button
                        className="copy-all"
                        aria-label="复制事件内容"
                        title="复制当前内容"
                        onClick={() =>
                          copy(
                            tab === "xml"
                              ? selected.xml
                              : JSON.stringify(selected.fields, null, 2),
                          )
                        }
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    {tab === "fields" ? (
                      <>
                        <div className="field-search">
                          <Search size={13} />
                          <input
                            aria-label="搜索事件字段"
                            placeholder="查找字段或值…"
                            value={fieldSearch}
                            onChange={(e) => setFieldSearch(e.target.value)}
                          />
                        </div>
                        <div className="field-list">
                          {Object.entries(selected.fields)
                            .filter(([k, v]) =>
                              `${k} ${v}`
                                .toLowerCase()
                                .includes(fieldSearch.toLowerCase()),
                            )
                            .map(([key, value]) => (
                              <div className="field" key={key}>
                                <div>
                                  <span>{key}</span>
                                  <button
                                    aria-label={`复制 ${key}`}
                                    onClick={() => copy(value)}
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <p>{value || "（空值）"}</p>
                                {value && (
                                  <button
                                    className="field-pivot"
                                    onClick={() => {
                                      setView("events");
                                      setSearch(value);
                                      updateFilter({
                                        category: "",
                                        provider: "",
                                        event_id: null,
                                        file_id: null,
                                        page: 0,
                                      });
                                    }}
                                  >
                                    检索此值 <ArrowRight size={10} />
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      </>
                    ) : (
                      <pre className="xml-view">
                        {selected.xml.replace(/></g, ">\n<")}
                      </pre>
                    )}
                    <div className="detail-footer">
                      <ShieldCheck size={13} />
                      原始记录保留 · 日志级别不代表威胁等级
                    </div>
                  </>
                ) : (
                  <div className="detail-placeholder">
                    <div className="scan-graphic">
                      <span />
                      <FileCode2 size={36} />
                      <i />
                    </div>
                    <span className="eyebrow">LOOK A LITTLE CLOSER</span>
                    <h3>细节，让线索浮现。</h3>
                    <p>
                      选择一条事件，查看操作释义、
                      <br />
                      完整字段与原始 XML。
                    </p>
                    <div>
                      <kbd>↵</kbd> 打开事件 <span>·</span> <kbd>Esc</kbd>{" "}
                      关闭详情
                    </div>
                  </div>
                )}
              </aside>
            </section>
          )}
          {view === "catalog" && (
            <section className="panel catalog-panel">
              <div className="section-heading">
                <div>
                  <span className="section-index">03</span>
                  <h3>事件 ID 图鉴</h3>
                  <span className="count-badge">{dictionary.length}</span>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyPresent}
                    onChange={(e) => setOnlyPresent(e.target.checked)}
                  />
                  仅看已导入事件
                </label>
              </div>
              <div className="catalog-toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="搜索事件图鉴"
                    placeholder="搜索事件 ID、操作、类别或提供者…"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="图鉴提供者"
                  value={catalogProvider}
                  onChange={(e) => setCatalogProvider(e.target.value)}
                >
                  <option value="">全部提供者</option>
                  {[
                    ...new Set([
                      ...catalog.map((d) => d.provider),
                      ...stats.providers.map((p) => p.name),
                    ]),
                  ]
                    .sort()
                    .map((p) => (
                      <option key={p} value={p}>
                        {shortProvider(p)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="catalog-notice">
                <CircleHelp size={15} />
                同一个 ID
                在不同提供者中含义可能不同。字典提供常见释义；未知事件完整保留。
              </div>
              <div className="catalog-grid">
                {dictionary.map((d) => (
                  <article
                    className={`definition-card ${!d.known ? "unknown" : ""}`}
                    key={`${d.provider}/${d.channel}/${d.id}`}
                  >
                    <div className="definition-top">
                      <b>{d.id}</b>
                      <span>{d.category}</span>
                      {d.count > 0 && (
                        <button
                          title="查看相关事件"
                          onClick={() =>
                            pivot({ provider: d.provider, event_id: d.id })
                          }
                        >
                          {d.count} 条 <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                    <h3>{d.title}</h3>
                    <span className="provider-label" title={d.channel}>
                      {shortProvider(d.provider)}
                    </span>
                    <p>{d.description}</p>
                    <div className="definition-bottom">
                      {d.source ? (
                        <a
                          href={d.source}
                          onClick={(event) => followReference(d.source, event)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          参考文档 <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span>未收录释义</span>
                      )}
                      <button
                        onClick={() =>
                          pivot({ provider: d.provider, event_id: d.id })
                        }
                      >
                        检索事件 <ArrowRight size={12} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {dictionary.length === 0 && (
                <div className="simple-empty">
                  未找到匹配的事件释义，请调整条件。
                </div>
              )}
            </section>
          )}
          {view === "overview" && (
            <div className="overview-grid">
              <section className="panel timeline-panel">
                <OrbitFrame />
                <div className="section-heading">
                  <div>
                    <span className="section-index">01</span>
                    <h3>事件时间分布</h3>
                  </div>
                  <span className="muted">
                    {utc ? "UTC" : "本地时间"} · 聚合视图
                  </span>
                </div>
                <div className="timeline-chart">
                  {stats.timeline.length ? (
                    stats.timeline.map((b, i) => (
                      <div
                        className="timeline-bar-slot"
                        key={b.name}
                        title={`${displayTime(b.name, utc)} · ${b.count} 条`}
                      >
                        <div
                          className="timeline-bar"
                          style={{
                            height: `${Math.max(3, (b.count / maxTimeline) * 100)}%`,
                            animationDelay: `${i * 12}ms`,
                          }}
                        >
                          <span>{b.count}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="simple-empty">导入日志后显示时间分布</div>
                  )}
                </div>
                <div className="timeline-axis">
                  <span>{displayTime(stats.first, utc)}</span>
                  <Activity size={15} />
                  <span>{displayTime(stats.last, utc)}</span>
                </div>
              </section>
              <section className="panel distribution-panel">
                <OrbitFrame dial />
                <div className="section-heading">
                  <div>
                    <span className="section-index">02</span>
                    <h3>行为分类</h3>
                  </div>
                  <Layers3 size={16} />
                </div>
                <div className="distribution-list">
                  {stats.categories.map((b, i) => (
                    <button
                      key={b.name}
                      onClick={() => pivot({ category: b.name })}
                    >
                      <span className="distribution-label">
                        <i style={{ opacity: 1 - i * 0.065 }} />
                        {b.name}
                        <b>{fmt(b.count)}</b>
                      </span>
                      <span className="distribution-track">
                        <i
                          style={{
                            width: `${(b.count / Math.max(1, stats.total)) * 100}%`,
                          }}
                        />
                      </span>
                    </button>
                  ))}
                  {!stats.categories.length && (
                    <div className="simple-empty">等待日志数据</div>
                  )}
                </div>
              </section>
              <section className="panel types-panel">
                <OrbitFrame />
                <div className="section-heading">
                  <div>
                    <span className="section-index">03</span>
                    <h3>高频事件</h3>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("catalog")}
                  >
                    打开图鉴 <ArrowRight size={14} />
                  </button>
                </div>
                <div className="top-types">
                  {stats.types.slice(0, 10).map((t, i) => (
                    <button
                      key={`${t.provider}/${t.channel}/${t.event_id}`}
                      onClick={() =>
                        pivot({ provider: t.provider, event_id: t.event_id })
                      }
                    >
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="event-id">{t.event_id}</span>
                      <span>
                        <strong>{t.operation}</strong>
                        <small>{shortProvider(t.provider)}</small>
                      </span>
                      <b>{fmt(t.count)}</b>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {!stats.types.length && (
                    <div className="simple-empty">尚无事件</div>
                  )}
                </div>
              </section>
              <section className="panel files-panel">
                <OrbitFrame />
                <div className="section-heading">
                  <div>
                    <span className="section-index">04</span>
                    <h3>证据源文件</h3>
                  </div>
                  <ShieldCheck size={17} />
                </div>
                <div className="file-cards">
                  {stats.files.map((f) => (
                    <article key={f.id}>
                      <FileCode2 size={24} />
                      <div>
                        <h4>{f.name}</h4>
                        <p>
                          {fmt(f.count)} 条记录 · {f.errors} 个解析错误
                        </p>
                        <span>{f.path}</span>
                        <small>SHA-256</small>
                        <code>{f.hash || "未提供哈希"}</code>
                        <div className="source-file-actions">
                          <button
                            className="text-button"
                            onClick={() => pivot({ file_id: f.id })}
                          >
                            浏览此文件 <ArrowRight size={13} />
                          </button>
                          <button
                            className="text-button unload-file-action"
                            disabled={importing || unloading}
                            onClick={() => setUnloadTarget(f)}
                          >
                            <LogOut size={13} />
                            卸载日志
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!stats.files.length && (
                    <div className="simple-empty">
                      添加日志文件以建立本地证据索引
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
          {view === "settings" && (
            <div className="settings-grid">
              <section className="panel appearance-panel">
                <div className="section-heading">
                  <div>
                    <Palette size={18} />
                    <h3>视觉主题</h3>
                  </div>
                  <span className="muted">PERSONAL PALETTE</span>
                </div>
                <div className="theme-grid">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      className={`theme-card ${theme === t.id ? "active" : ""}`}
                      onClick={() => setTheme(t.id)}
                    >
                      <span
                        className="theme-preview"
                        style={
                          {
                            "--preview-primary": t.colors[0],
                            "--preview-accent": t.colors[1],
                          } as React.CSSProperties
                        }
                      >
                        <i />
                        <b />
                        <span>AURA</span>
                        <em />
                      </span>
                      <span className="theme-name">
                        {t.name}
                        {theme === t.id && <Check size={15} />}
                      </span>
                      <small>{t.subtitle}</small>
                    </button>
                  ))}
                </div>
                <div className="settings-row">
                  <div>
                    <h4>明暗模式</h4>
                    <p>保留主题配色，切换工作环境亮度。</p>
                  </div>
                  <div className="segmented">
                    <button
                      className={mode === "dark" ? "active" : ""}
                      onClick={() => setMode("dark")}
                    >
                      <Moon size={15} />
                      深色
                    </button>
                    <button
                      className={mode === "light" ? "active" : ""}
                      onClick={() => setMode("light")}
                    >
                      <Sun size={15} />
                      浅色
                    </button>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <h4>界面动态</h4>
                    <p>
                      轨道、背景光晕、扫描线与交互过渡。系统减少动态偏好优先。
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={motion}
                    aria-label="界面动态"
                    className={`toggle ${motion ? "on" : ""}`}
                    onClick={() => setMotion(!motion)}
                  >
                    <span />
                  </button>
                </div>
                <div className="settings-row">
                  <div>
                    <h4>时间显示</h4>
                    <p>原始记录保留 UTC 时间；此设置仅改变显示。</p>
                  </div>
                  <div className="segmented">
                    <button
                      className={utc ? "active" : ""}
                      onClick={() => setUtc(true)}
                    >
                      UTC
                    </button>
                    <button
                      className={!utc ? "active" : ""}
                      onClick={() => setUtc(false)}
                    >
                      本地时间
                    </button>
                  </div>
                </div>
              </section>
              <section className="panel about-panel">
                <div className="about-mark">
                  A<span>/</span>
                </div>
                <span className="eyebrow">AURA EVTX / 0.3.2</span>
                <h3>
                  每一条日志，
                  <br />
                  都有它的故事。
                </h3>
                <p>
                  为 Windows 事件调查打造的本地工作台。支持标准 EVTX
                  文件的通用解析，不限制日志提供者。
                </p>
                <div className="about-features">
                  <span>
                    <ShieldCheck size={15} />
                    本地解析与 SQLite 索引
                  </span>
                  <span>
                    <BookOpen size={15} />
                    {catalog.length} 条提供者级事件释义
                  </span>
                  <span>
                    <Terminal size={15} />
                    Tauri 2 · Rust · React
                  </span>
                </div>
                <div className="shortcut-list">
                  <span>
                    导入日志<kbd>Ctrl O</kbd>
                  </span>
                  <span>
                    搜索事件<kbd>Ctrl K</kbd>
                  </span>
                  <span>
                    关闭详情<kbd>Esc</kbd>
                  </span>
                </div>
                <p className="about-note">
                  日志级别是提供者定义的诊断级别，不代表威胁风险。未知事件请结合原始字段和提供者文档分析。
                </p>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <span className="live-dot" />{" "}
              {native ? "LOCAL WORKSPACE" : "BROWSER PREVIEW"} <i>/</i>{" "}
              {stats.total
                ? `${fmt(stats.total)} RECORDS INDEXED`
                : "AWAITING EVIDENCE"}
            </span>
            <span>
              AURA EVTX <b>分析有据 · 洞察有形</b>
              <Sparkles size={12} />
            </span>
          </footer>
        </div>
      </main>
      {dragging && (
        <div className="drop-overlay">
          <div>
            <FileUp size={50} />
            <h2>释放文件，开始索引。</h2>
            <p>支持多个 EVTX 文件及整个日志目录</p>
            <span>DROP YOUR EVIDENCE HERE</span>
          </div>
        </div>
      )}
      {unloadTarget && (
        <UnloadDialog
          file={unloadTarget}
          busy={unloading}
          error={error}
          onClose={() => setUnloadTarget(null)}
          onConfirm={() => void unloadFile()}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  en,
  value,
  note,
  wide = false,
}: {
  icon: typeof Database;
  label: string;
  en: string;
  value: string;
  note: string;
  wide?: boolean;
}) {
  return (
    <article className={`metric ${wide ? "metric-wide" : ""}`}>
      <DialRim />
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="metric-value">
        {value}
        <span>
          {en === "HOSTS"
            ? "HOSTS"
            : en === "TOTAL EVENTS"
              ? "EVENTS"
              : en === "EVENT TYPES"
                ? "TYPES"
                : ""}
        </span>
      </div>
      <div className="metric-bottom">
        <span>{note}</span>
        <small>{en}</small>
      </div>
    </article>
  );
}
