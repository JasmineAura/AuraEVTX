use chrono::{DateTime, SecondsFormat};
use evtx::EvtxParser;
use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::File,
    io::{BufReader, Read},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
};

type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Definition {
    pub provider: String,
    pub channel: String,
    pub id: u32,
    pub title: String,
    pub category: String,
    pub description: String,
    pub source: String,
}
pub fn catalog() -> &'static Vec<Definition> {
    static CATALOG: OnceLock<Vec<Definition>> = OnceLock::new();
    CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!("../../shared/catalog.json"))
            .expect("valid built-in catalog")
    })
}
pub fn definition(provider: &str, channel: &str, id: u32) -> Option<&'static Definition> {
    catalog().iter().find(|d| {
        d.id == id
            && d.provider.eq_ignore_ascii_case(provider)
            && d.channel.eq_ignore_ascii_case(channel)
    })
}
pub fn connect(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path).map_err(err)?;
    conn.busy_timeout(std::time::Duration::from_secs(15))
        .map_err(err)?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(err)?;
    Ok(conn)
}
pub fn initialize(path: &Path) -> Result<()> {
    let conn = connect(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, hash TEXT UNIQUE NOT NULL, count INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, file_id INTEGER NOT NULL REFERENCES files(id), record_id INTEGER NOT NULL, event_id INTEGER NOT NULL, provider TEXT NOT NULL, channel TEXT NOT NULL, computer TEXT NOT NULL, time TEXT NOT NULL, level INTEGER NOT NULL, operation TEXT NOT NULL, category TEXT NOT NULL, summary TEXT NOT NULL, fields TEXT NOT NULL, xml TEXT NOT NULL, bookmarked INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS idx_events_time ON events(time);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(provider,channel,event_id);
        CREATE INDEX IF NOT EXISTS idx_events_file ON events(file_id);
        CREATE INDEX IF NOT EXISTS idx_events_bookmark ON events(bookmarked);").map_err(err)
}

#[derive(Clone, Debug, Serialize)]
pub struct EventRow {
    pub id: i64,
    pub file_id: i64,
    pub record_id: u64,
    pub event_id: u32,
    pub provider: String,
    pub channel: String,
    pub computer: String,
    pub time: String,
    pub level: u8,
    pub operation: String,
    pub category: String,
    pub summary: String,
    pub bookmarked: bool,
    pub source: String,
}
#[derive(Serialize)]
pub struct Detail {
    #[serde(flatten)]
    pub event: EventRow,
    pub fields: BTreeMap<String, String>,
    pub xml: String,
}
#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Filter {
    pub search: String,
    pub provider: String,
    pub event_id: Option<u32>,
    pub level: Option<u8>,
    pub file_id: Option<i64>,
    pub category: String,
    pub from: String,
    pub until: String,
    pub bookmarked: bool,
    pub page: u32,
    pub page_size: u32,
    pub ascending: bool,
}
fn conditions(f: &Filter) -> (String, Vec<Value>) {
    let mut sql = String::from(" WHERE 1=1");
    let mut args = vec![];
    if !f.search.is_empty() {
        sql.push_str(" AND (e.summary LIKE ? ESCAPE '\\' OR e.fields LIKE ? ESCAPE '\\' OR e.xml LIKE ? ESCAPE '\\' OR e.operation LIKE ? ESCAPE '\\' OR e.computer LIKE ? ESCAPE '\\' OR e.provider LIKE ? ESCAPE '\\')");
        let text = format!(
            "%{}%",
            f.search
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        );
        for _ in 0..6 {
            args.push(Value::Text(text.clone()));
        }
    }
    for (column, value) in [("provider", &f.provider), ("category", &f.category)] {
        if !value.is_empty() {
            sql.push_str(&format!(" AND e.{column}=?"));
            args.push(Value::Text(value.clone()));
        }
    }
    for (column, value) in [
        ("event_id", f.event_id.map(i64::from)),
        ("level", f.level.map(i64::from)),
        ("file_id", f.file_id),
    ] {
        if let Some(v) = value {
            sql.push_str(&format!(" AND e.{column}=?"));
            args.push(Value::Integer(v));
        }
    }
    if !f.from.is_empty() {
        sql.push_str(" AND e.time>=?");
        args.push(Value::Text(f.from.clone()));
    }
    if !f.until.is_empty() {
        sql.push_str(" AND e.time<=?");
        args.push(Value::Text(f.until.clone()));
    }
    if f.bookmarked {
        sql.push_str(" AND e.bookmarked=1");
    }
    (sql, args)
}
const COLUMNS: &str = "e.id,e.file_id,e.record_id,e.event_id,e.provider,e.channel,e.computer,e.time,e.level,e.operation,e.category,e.summary,e.bookmarked,f.name";
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<EventRow> {
    Ok(EventRow {
        id: r.get(0)?,
        file_id: r.get(1)?,
        record_id: r.get(2)?,
        event_id: r.get(3)?,
        provider: r.get(4)?,
        channel: r.get(5)?,
        computer: r.get(6)?,
        time: r.get(7)?,
        level: r.get(8)?,
        operation: r.get(9)?,
        category: r.get(10)?,
        summary: r.get(11)?,
        bookmarked: r.get(12)?,
        source: r.get(13)?,
    })
}
#[derive(Serialize)]
pub struct Page {
    pub rows: Vec<EventRow>,
    pub total: u64,
}
pub fn query(path: &Path, filter: &Filter) -> Result<Page> {
    let conn = connect(path)?;
    let (where_sql, mut args) = conditions(filter);
    let total = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM events e{where_sql}"),
            params_from_iter(args.iter()),
            |r| r.get(0),
        )
        .map_err(err)?;
    let direction = if filter.ascending { "ASC" } else { "DESC" };
    let size = filter.page_size.clamp(1, 200);
    args.push(Value::Integer(size.into()));
    args.push(Value::Integer(i64::from(filter.page) * i64::from(size)));
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM events e JOIN files f ON f.id=e.file_id{where_sql} ORDER BY e.time {direction}, e.id {direction} LIMIT ? OFFSET ?")).map_err(err)?;
    let rows = stmt
        .query_map(params_from_iter(args.iter()), row)
        .map_err(err)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(err)?;
    Ok(Page { rows, total })
}
pub fn detail(path: &Path, id: i64) -> Result<Detail> {
    let conn = connect(path)?;
    conn.query_row(&format!("SELECT {COLUMNS},e.fields,e.xml FROM events e JOIN files f ON f.id=e.file_id WHERE e.id=?"), [id], |r| {
        let text: String = r.get(14)?;
        Ok(Detail {event:row(r)?,fields:serde_json::from_str(&text).unwrap_or_default(),xml:r.get(15)?})
    }).map_err(err)
}
#[derive(Serialize)]
pub struct SourceFile {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub hash: String,
    pub count: u64,
    pub errors: u64,
}
#[derive(Serialize)]
pub struct Bucket {
    pub name: String,
    pub count: u64,
}
#[derive(Serialize)]
pub struct EventType {
    pub provider: String,
    pub channel: String,
    pub event_id: u32,
    pub operation: String,
    pub category: String,
    pub count: u64,
}
#[derive(Serialize)]
pub struct Stats {
    pub total: u64,
    pub bookmarks: u64,
    pub computers: u64,
    pub first: Option<String>,
    pub last: Option<String>,
    pub files: Vec<SourceFile>,
    pub providers: Vec<Bucket>,
    pub categories: Vec<Bucket>,
    pub levels: Vec<Bucket>,
    pub timeline: Vec<Bucket>,
    pub types: Vec<EventType>,
}
pub fn stats(path: &Path) -> Result<Stats> {
    let conn = connect(path)?;
    let (total, bookmarks, computers, first, last) = conn.query_row("SELECT COUNT(*),COALESCE(SUM(bookmarked),0),COUNT(DISTINCT NULLIF(computer,'')),MIN(time),MAX(time) FROM events", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).map_err(err)?;
    let files = conn
        .prepare("SELECT id,name,path,hash,count,errors FROM files ORDER BY id DESC")
        .map_err(err)?
        .query_map([], |r| {
            Ok(SourceFile {
                id: r.get(0)?,
                name: r.get(1)?,
                path: r.get(2)?,
                hash: r.get(3)?,
                count: r.get(4)?,
                errors: r.get(5)?,
            })
        })
        .map_err(err)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(err)?;
    fn buckets(conn: &Connection, sql: &str) -> Result<Vec<Bucket>> {
        conn.prepare(sql)
            .map_err(err)?
            .query_map([], |r| {
                Ok(Bucket {
                    name: r.get(0)?,
                    count: r.get(1)?,
                })
            })
            .map_err(err)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err)
    }
    let providers = buckets(
        &conn,
        "SELECT provider,COUNT(*) FROM events GROUP BY provider ORDER BY COUNT(*) DESC",
    )?;
    let categories = buckets(
        &conn,
        "SELECT category,COUNT(*) FROM events GROUP BY category ORDER BY COUNT(*) DESC",
    )?;
    let levels = buckets(
        &conn,
        "SELECT CAST(level AS TEXT),COUNT(*) FROM events GROUP BY level ORDER BY level",
    )?;
    // At most 32 chronological buckets, including very long evidence windows.
    let timeline = buckets(&conn,"WITH bounds AS (SELECT MIN(julianday(time)) lo,MAX(julianday(time)) hi FROM events), grouped AS (SELECT MIN(time) name,COUNT(*) n,CASE WHEN hi=lo THEN 0 ELSE MIN(31,CAST((julianday(time)-lo)/(hi-lo)*32 AS INTEGER)) END b FROM events,bounds GROUP BY b) SELECT name,n FROM grouped ORDER BY b")?;
    let types = conn.prepare("SELECT provider,channel,event_id,operation,category,COUNT(*) FROM events GROUP BY provider,channel,event_id ORDER BY COUNT(*) DESC").map_err(err)?.query_map([], |r| Ok(EventType{provider:r.get(0)?,channel:r.get(1)?,event_id:r.get(2)?,operation:r.get(3)?,category:r.get(4)?,count:r.get(5)?})).map_err(err)?.collect::<rusqlite::Result<Vec<_>>>().map_err(err)?;
    Ok(Stats {
        total,
        bookmarks,
        computers,
        first,
        last,
        files,
        providers,
        categories,
        levels,
        timeline,
        types,
    })
}
pub fn bookmark(path: &Path, id: i64, enabled: bool) -> Result<()> {
    connect(path)?
        .execute(
            "UPDATE events SET bookmarked=? WHERE id=?",
            params![enabled, id],
        )
        .map_err(err)?;
    Ok(())
}

pub struct Parsed {
    pub record_id: u64,
    pub event_id: u32,
    pub provider: String,
    pub channel: String,
    pub computer: String,
    pub time: String,
    pub level: u8,
    pub operation: String,
    pub category: String,
    pub summary: String,
    pub fields: BTreeMap<String, String>,
}
pub fn parse_xml(xml: &str, fallback_id: u64) -> Result<Parsed> {
    // EVTX strings may contain control characters that XML 1.0 forbids.
    // Parse through collision-free placeholders, then restore exact field values.
    // The original serialized XML is always stored unchanged.
    let illegal = |c: char| {
        !(matches!(c, '\t' | '\n' | '\r') || c >= ' ' && c != '\u{fffe}' && c != '\u{ffff}')
    };
    let mut marker = "__AURA_XML_CONTROL_".to_string();
    while xml.contains(&marker) {
        marker.push('_');
    }
    let mut replacements = BTreeMap::new();
    let normalized = if xml.chars().any(illegal) {
        std::borrow::Cow::Owned(
            xml.chars()
                .map(|c| {
                    if illegal(c) {
                        let token = format!("{marker}{:x}__", c as u32);
                        replacements.insert(token.clone(), c.to_string());
                        token
                    } else {
                        c.to_string()
                    }
                })
                .collect::<String>(),
        )
    } else {
        std::borrow::Cow::Borrowed(xml)
    };
    let restore = |s: String| {
        replacements
            .iter()
            .fold(s, |text, (token, value)| text.replace(token, value))
    };
    let doc = roxmltree::Document::parse(&normalized).map_err(err)?;
    let system = doc
        .root_element()
        .children()
        .find(|n| n.has_tag_name("System"))
        .ok_or("缺少 System 节点")?;
    let value = |tag: &str| {
        system
            .children()
            .find(|n| n.has_tag_name(tag))
            .and_then(|n| n.text())
            .unwrap_or("")
            .to_string()
    };
    let provider = system
        .children()
        .find(|n| n.has_tag_name("Provider"))
        .and_then(|n| n.attribute("Name").or_else(|| n.attribute("Guid")))
        .unwrap_or("Unknown provider")
        .to_string();
    let event_id = value("EventID").parse().map_err(|_| "EventID 无效")?;
    let channel = value("Channel");
    let raw_time = system
        .children()
        .find(|n| n.has_tag_name("TimeCreated"))
        .and_then(|n| n.attribute("SystemTime"))
        .unwrap_or("");
    let time = DateTime::parse_from_rfc3339(raw_time)
        .map_err(|e| format!("无效的事件时间 {raw_time}: {e}"))?
        .to_utc()
        .to_rfc3339_opts(SecondsFormat::Nanos, true);
    let mut fields = BTreeMap::new();
    for payload in doc
        .root_element()
        .children()
        .filter(|n| n.is_element() && !n.has_tag_name("System"))
    {
        for n in payload.descendants().filter(|n| n.is_element()) {
            let path = || {
                let mut parts: Vec<_> = n
                    .ancestors()
                    .filter(|a| a.is_element())
                    .map(|a| a.tag_name().name())
                    .collect();
                parts.reverse();
                parts.join("/")
            };
            for a in n.attributes() {
                if a.name() != "Name" || !n.has_tag_name("Data") {
                    fields.insert(format!("{}/@{}", path(), a.name()), a.value().to_string());
                }
            }
            if n.children().any(|c| c.is_element()) {
                continue;
            }
            let key = if n.has_tag_name("Data") {
                n.attribute("Name").map(String::from).unwrap_or_else(path)
            } else {
                path()
            };
            let mut unique = key.clone();
            let mut duplicate = 2;
            while fields.contains_key(&unique) {
                unique = format!("{key} [{duplicate}]");
                duplicate += 1;
            }
            fields.insert(unique, n.text().unwrap_or("").to_string());
        }
    }
    let def = definition(&provider, &channel, event_id);
    let operation = def
        .map(|d| d.title.clone())
        .unwrap_or_else(|| format!("事件 {event_id} · 未收录释义"));
    let category = def
        .map(|d| d.category.clone())
        .unwrap_or_else(|| "其他".into());
    let summary = [
        "Image",
        "CommandLine",
        "TargetFilename",
        "TargetObject",
        "QueryName",
        "DestinationIp",
        "TargetUserName",
        "ServiceName",
        "ScriptBlockText",
    ]
    .iter()
    .filter_map(|key| {
        fields
            .get(*key)
            .filter(|v| !v.is_empty())
            .map(|v| format!("{key}: {v}"))
    })
    .collect::<Vec<_>>()
    .join(" · ");
    let summary = if summary.is_empty() {
        fields
            .iter()
            .take(4)
            .map(|(k, v)| format!("{k}: {v}"))
            .collect::<Vec<_>>()
            .join(" · ")
    } else {
        summary
    };
    for n in system.descendants().filter(|n| n.is_element()) {
        let key = format!("System/{}", n.tag_name().name());
        for a in n.attributes() {
            fields.insert(format!("{key}/@{}", a.name()), a.value().into());
        }
        if let Some(text) = n.text().filter(|_| !n.children().any(|c| c.is_element())) {
            fields.insert(key, text.into());
        }
    }
    Ok(Parsed {
        record_id: value("EventRecordID").parse().unwrap_or(fallback_id),
        event_id,
        provider,
        channel,
        computer: value("Computer"),
        time,
        level: value("Level").parse().unwrap_or(0),
        operation,
        category,
        summary: restore(summary).chars().take(1500).collect(),
        fields: fields
            .into_iter()
            .map(|(k, v)| (restore(k), restore(v)))
            .collect(),
    })
}
#[derive(Clone, Serialize, Default)]
pub struct Progress {
    pub file: String,
    pub file_index: usize,
    pub file_total: usize,
    pub records: u64,
    pub errors: u64,
    pub stage: String,
}
#[derive(Default, Serialize)]
pub struct ImportReport {
    pub imported: usize,
    pub skipped: usize,
    pub records: u64,
    pub errors: u64,
    pub cancelled: bool,
    pub messages: Vec<String>,
}
pub fn import(
    path: &Path,
    inputs: Vec<String>,
    cancelled: &AtomicBool,
    notify: impl Fn(Progress),
) -> Result<ImportReport> {
    let mut files = vec![];
    let mut report = ImportReport::default();
    for input in inputs {
        let p = PathBuf::from(input);
        if p.is_dir() {
            for entry in walkdir::WalkDir::new(&p).follow_links(false) {
                match entry {
                    Ok(e)
                        if e.file_type().is_file()
                            && e.path()
                                .extension()
                                .is_some_and(|x| x.eq_ignore_ascii_case("evtx")) =>
                    {
                        files.push(e.into_path())
                    }
                    Err(e) => {
                        report.errors += 1;
                        if report.messages.len() < 30 {
                            report.messages.push(e.to_string());
                        }
                    }
                    _ => {}
                }
            }
        } else {
            files.push(p);
        }
    }
    files.sort();
    files.dedup();
    if files.is_empty() {
        return Err("所选目录中未找到 EVTX 文件".into());
    }
    let mut conn = connect(path)?;
    for (index, file) in files.iter().enumerate() {
        if cancelled.load(Ordering::Relaxed) {
            report.cancelled = true;
            break;
        }
        let name = file
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let progress = |records, errors, stage: &str| {
            notify(Progress {
                file: name.clone(),
                file_index: index + 1,
                file_total: files.len(),
                records,
                errors,
                stage: stage.into(),
            })
        };
        progress(0, 0, "读取文件");
        let result = (|| -> Result<Option<(u64, u64)>> {
            let mut reader = BufReader::new(File::open(file).map_err(err)?);
            let mut hash = Sha256::new();
            let mut buf = [0u8; 65536];
            loop {
                if cancelled.load(Ordering::Relaxed) {
                    return Ok(None);
                }
                let n = reader.read(&mut buf).map_err(err)?;
                if n == 0 {
                    break;
                }
                hash.update(&buf[..n]);
            }
            let hash = format!("{:x}", hash.finalize());
            if conn
                .query_row("SELECT id FROM files WHERE hash=?", [&hash], |r| {
                    r.get::<_, i64>(0)
                })
                .optional()
                .map_err(err)?
                .is_some()
            {
                report.skipped += 1;
                return Ok(None);
            }
            let mut parser = EvtxParser::from_path(file).map_err(err)?;
            let tx = conn.transaction().map_err(err)?;
            tx.execute(
                "INSERT INTO files(name,path,hash) VALUES(?,?,?)",
                params![name, file.to_string_lossy(), hash],
            )
            .map_err(err)?;
            let file_id = tx.last_insert_rowid();
            let mut count = 0;
            let mut errors = 0;
            {
                let mut insert = tx.prepare("INSERT INTO events(file_id,record_id,event_id,provider,channel,computer,time,level,operation,category,summary,fields,xml) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").map_err(err)?;
                for record in parser.records() {
                    if cancelled.load(Ordering::Relaxed) {
                        return Ok(None);
                    }
                    let parsed = record
                        .map_err(err)
                        .and_then(|r| parse_xml(&r.data, r.event_record_id).map(|p| (p, r.data)));
                    match parsed {
                        Ok((p, xml)) => {
                            insert
                                .execute(params![
                                    file_id,
                                    p.record_id,
                                    p.event_id,
                                    p.provider,
                                    p.channel,
                                    p.computer,
                                    p.time,
                                    p.level,
                                    p.operation,
                                    p.category,
                                    p.summary,
                                    serde_json::to_string(&p.fields).map_err(err)?,
                                    xml
                                ])
                                .map_err(err)?;
                            count += 1;
                        }
                        Err(e) => {
                            errors += 1;
                            if report.messages.len() < 30 {
                                report.messages.push(format!("{name}: {e}"));
                            }
                        }
                    }
                    if (count + errors) % 200 == 0 {
                        progress(count, errors, "解析与索引");
                    }
                }
            }
            tx.execute(
                "UPDATE files SET count=?,errors=? WHERE id=?",
                params![count, errors, file_id],
            )
            .map_err(err)?;
            tx.commit().map_err(err)?;
            Ok(Some((count, errors)))
        })();
        match result {
            Ok(Some((count, errors))) => {
                report.imported += 1;
                report.records += count;
                report.errors += errors;
                progress(count, errors, "完成");
            }
            Ok(None) => {}
            Err(e) => {
                report.errors += 1;
                if report.messages.len() < 30 {
                    report.messages.push(format!("{name}: {e}"));
                }
            }
        }
        if cancelled.load(Ordering::Relaxed) {
            report.cancelled = true;
            break;
        }
    }
    Ok(report)
}
pub fn export(path: &Path, filter: &Filter, output: &Path) -> Result<u64> {
    if !output
        .extension()
        .is_some_and(|s| s.eq_ignore_ascii_case("csv"))
    {
        return Err("导出文件需要使用 .csv 扩展名".into());
    }
    let conn = connect(path)?;
    let (where_sql, args) = conditions(filter);
    let mut stmt=conn.prepare(&format!("SELECT {COLUMNS},e.fields FROM events e JOIN files f ON f.id=e.file_id{where_sql} ORDER BY e.time,e.id")).map_err(err)?;
    let mut rows = stmt.query(params_from_iter(args.iter())).map_err(err)?;
    // create_new prevents accidental overwrite of evidence or an existing report.
    let mut output = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(output)
        .map_err(|e| format!("无法创建导出文件（请选择尚不存在的文件名）: {e}"))?;
    std::io::Write::write_all(&mut output, b"\xef\xbb\xbf").map_err(err)?;
    let mut writer = csv::Writer::from_writer(output);
    writer
        .write_record([
            "时间 UTC",
            "提供者",
            "通道",
            "事件 ID",
            "操作",
            "分类",
            "主机",
            "日志级别",
            "记录 ID",
            "源文件",
            "事件字段 JSON",
        ])
        .map_err(err)?;
    let safe = |s: String| {
        if s.starts_with(['=', '+', '-', '@', '\t', '\r', '\n']) {
            format!("'{s}")
        } else {
            s
        }
    };
    let mut count = 0;
    while let Some(r) = rows.next().map_err(err)? {
        let e = row(r).map_err(err)?;
        let fields: String = r.get(14).map_err(err)?;
        writer
            .write_record(
                [
                    e.time,
                    e.provider,
                    e.channel,
                    e.event_id.to_string(),
                    e.operation,
                    e.category,
                    e.computer,
                    e.level.to_string(),
                    e.record_id.to_string(),
                    e.source,
                    fields,
                ]
                .map(safe),
            )
            .map_err(err)?;
        count += 1;
    }
    writer.flush().map_err(err)?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "Download upstream fixtures with scripts/verify-generic.ps1"]
    fn generic_evtx_matches_windows_native_counts() {
        let dir = std::env::var("AURA_EVTX_FIXTURES").expect("fixture directory");
        let expected: BTreeMap<String, u64> = serde_json::from_str(
            &std::fs::read_to_string(Path::new(&dir).join("expected.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(expected.len(), 3);
        let db = Path::new(&dir).join(format!("generic-{}.db", std::process::id()));
        initialize(&db).unwrap();
        for (name, count) in expected {
            let report = import(
                &db,
                vec![Path::new(&dir).join(&name).to_string_lossy().into()],
                &AtomicBool::new(false),
                |_| {},
            )
            .unwrap();
            assert_eq!(report.records, count, "{name}: {:?}", report.messages);
            assert_eq!(report.errors, 0, "{name}");
            println!("{name}: {} events, matching Get-WinEvent", report.records);
        }
        let summary = stats(&db).unwrap();
        assert!(summary.providers.len() > 3);
        assert!(summary.types.iter().any(|t| t.category == "其他"));
        let _ = std::fs::remove_file(db);
    }
    #[test]
    fn generic_xml_preserves_unknown_userdata_and_duplicate_fields() {
        let xml = r#"<Event><System><Provider Name="ThirdParty"/><EventID>1</EventID><TimeCreated SystemTime="2024-02-14T03:41:26.4441194Z"/><Level>4</Level><Channel>Custom</Channel><Computer>host</Computer></System><UserData><Payload><Name>A</Name></Payload></UserData><EventData><Data Name="x">one</Data><Data Name="x">two</Data></EventData></Event>"#;
        let p = parse_xml(xml, 7).unwrap();
        assert_eq!(p.record_id, 7);
        assert_eq!(p.category, "其他");
        assert_eq!(p.fields["Event/UserData/Payload/Name"], "A");
        assert_eq!(p.fields["x [2]"], "two");
        assert!(definition("ThirdParty", "Custom", 1).is_none());
        assert!(definition("Microsoft-Windows-Sysmon", "WrongChannel", 1).is_none());
        let controlled = xml.replace("one", "one\u{3}__AURA_XML_CONTROL_");
        assert_eq!(
            parse_xml(&controlled, 7).unwrap().fields["x"],
            "one\u{3}__AURA_XML_CONTROL_"
        );
    }
    #[test]
    #[ignore = "Requires local EVTX fixture; set AURA_EVTX_TEST_SAMPLE"]
    fn sample_import_query_bookmark_export_and_dedup() {
        let path = std::env::temp_dir().join(format!("aura-test-{}.db", std::process::id()));
        initialize(&path).unwrap();
        let sample = std::env::var("AURA_EVTX_TEST_SAMPLE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                Path::new(env!("CARGO_MANIFEST_DIR")).join("../.local-fixtures/investigation.evtx")
            });
        let cancel = AtomicBool::new(false);
        let r = import(
            &path,
            vec![sample.to_string_lossy().into()],
            &cancel,
            |_| {},
        )
        .unwrap();
        assert_eq!(r.records, 169);
        assert_eq!(r.errors, 0);
        let s = stats(&path).unwrap();
        assert_eq!(s.total, 169);
        assert_eq!(s.computers, 1);
        assert_eq!(s.types.len(), 14);
        let f = Filter {
            event_id: Some(1),
            ..Default::default()
        };
        let p = query(&path, &f).unwrap();
        assert_eq!(p.total, 6);
        let d = detail(&path, p.rows[0].id).unwrap();
        assert!(!d.xml.is_empty());
        assert!(d.fields.contains_key("ProcessGuid"));
        bookmark(&path, d.event.id, true).unwrap();
        assert_eq!(
            query(
                &path,
                &Filter {
                    bookmarked: true,
                    ..Default::default()
                }
            )
            .unwrap()
            .total,
            1
        );
        let dest = path.with_extension("csv");
        assert_eq!(export(&path, &f, &dest).unwrap(), 6);
        assert!(export(&path, &f, &dest).is_err());
        assert_eq!(
            import(
                &path,
                vec![sample.to_string_lossy().into()],
                &cancel,
                |_| {}
            )
            .unwrap()
            .skipped,
            1
        );
        assert_eq!(
            query(
                &path,
                &Filter {
                    search: "Preventivo".into(),
                    ..Default::default()
                }
            )
            .unwrap()
            .total
                > 0,
            true
        );
        assert_eq!(
            query(
                &path,
                &Filter {
                    search: "' OR 1=1 --".into(),
                    ..Default::default()
                }
            )
            .unwrap()
            .total,
            0
        );
        let _ = std::fs::remove_file(dest);
        let _ = std::fs::remove_file(path);
    }
}
