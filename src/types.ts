export interface Definition {
  provider: string;
  channel: string;
  id: number;
  title: string;
  category: string;
  description: string;
  source: string;
}
export interface EventRow {
  id: number;
  file_id: number;
  record_id: number;
  event_id: number;
  provider: string;
  channel: string;
  computer: string;
  time: string;
  level: number;
  operation: string;
  category: string;
  summary: string;
  bookmarked: boolean;
  source: string;
}
export interface Detail extends EventRow {
  fields: Record<string, string>;
  xml: string;
}
export interface SourceFile {
  id: number;
  name: string;
  path: string;
  hash: string;
  count: number;
  errors: number;
}
export interface Bucket {
  name: string;
  count: number;
}
export interface EventType {
  provider: string;
  channel: string;
  event_id: number;
  operation: string;
  category: string;
  count: number;
}
export interface Stats {
  total: number;
  bookmarks: number;
  computers: number;
  first: string | null;
  last: string | null;
  files: SourceFile[];
  providers: Bucket[];
  categories: Bucket[];
  levels: Bucket[];
  timeline: Bucket[];
  types: EventType[];
}
export interface Filter {
  search: string;
  provider: string;
  event_id: number | null;
  level: number | null;
  file_id: number | null;
  category: string;
  from: string;
  until: string;
  bookmarked: boolean;
  page: number;
  page_size: number;
  ascending: boolean;
}
export interface Page {
  rows: EventRow[];
  total: number;
}
export interface Progress {
  file: string;
  file_index: number;
  file_total: number;
  records: number;
  errors: number;
  stage: string;
}
export interface ImportReport {
  imported: number;
  skipped: number;
  records: number;
  errors: number;
  cancelled: boolean;
  messages: string[];
}
export const initialFilter: Filter = {
  search: "",
  provider: "",
  event_id: null,
  level: null,
  file_id: null,
  category: "",
  from: "",
  until: "",
  bookmarked: false,
  page: 0,
  page_size: 50,
  ascending: true,
};
export const emptyStats: Stats = {
  total: 0,
  bookmarks: 0,
  computers: 0,
  first: null,
  last: null,
  files: [],
  providers: [],
  categories: [],
  levels: [],
  timeline: [],
  types: [],
};
export const levels: Record<number, string> = {
  0: "日志始终",
  1: "严重",
  2: "错误",
  3: "警告",
  4: "信息",
  5: "详细",
};
