import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emptyStats } from "./types";

export const native = isTauri();
export const streamWindow = native
  ? getCurrentWindow().label === "event-stream"
  : new URLSearchParams(location.search).get("window") === "events";

export async function api<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (native) return invoke<T>(command, args);
  if (command === "get_stats") return emptyStats as T;
  if (command === "query_events") return { rows: [], total: 0 } as T;
  throw new Error("请在 AuraEVTX 桌面应用中导入和分析本地日志。");
}
