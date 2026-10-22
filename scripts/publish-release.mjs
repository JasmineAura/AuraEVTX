import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repo = "JasmineAura/AuraEVTX";
const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const tag = `v${version}`;
const git = (args, options = {}) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
    ...options,
  }).trim();
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  try {
    token = git(["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
    })
      .split("\n")
      .find((line) => line.startsWith("password="))
      ?.slice(9);
  } catch {
    throw new Error(
      "未找到 GitHub 凭据；请配置 Git Credential Manager 或 GH_TOKEN。",
    );
  }
}
if (!token) throw new Error("GitHub 凭据不可用。");
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
async function request(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `GitHub API ${response.status}: ${data.message || "request failed"}`,
    );
  return data;
}
if (git(["status", "--porcelain"]))
  throw new Error("请先提交工作区，再发布 Release。");
const sha = git(["rev-parse", "HEAD"]);
if (!git(["ls-remote", "--tags", "origin", `refs/tags/${tag}`]))
  throw new Error(`请先推送标签 ${tag}。`);
const files = [
  [
    "AuraEVTX-windows-x64.zip",
    resolve("release/AuraEVTX-windows-x64.zip"),
    "application/zip",
  ],
  [
    "AuraEVTX.exe",
    resolve("release/AuraEVTX.exe"),
    "application/vnd.microsoft.portable-executable",
  ],
  ["SHA256SUMS.txt", resolve("release/SHA256SUMS.txt"), "text/plain"],
];
for (const [, path] of files) statSync(path);
const existing = await fetch(
  `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
  { headers },
);
let release;
if (existing.status === 200) {
  release = await existing.json();
  if (!release.draft) throw new Error(`${tag} 已公开发布；不会覆盖现有版本。`);
} else if (existing.status === 404) {
  release = await request("/releases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: sha,
      name: `AuraEVTX ${tag} · 事件观测台`,
      body: readFileSync(
        new URL(`../docs/releases/${tag}.md`, import.meta.url),
        "utf8",
      ),
      draft: true,
      prerelease: false,
    }),
  });
} else {
  throw new Error(`无法检查 Release：HTTP ${existing.status}`);
}
const uploadBase = release.upload_url.replace(/\{.*$/, "");
if (new URL(uploadBase).hostname !== "uploads.github.com")
  throw new Error("GitHub 上传域名无效。");
for (const [name, path, contentType] of files) {
  const duplicate = release.assets.find((asset) => asset.name === name);
  if (duplicate)
    await request(`/releases/assets/${duplicate.id}`, { method: "DELETE" });
  const buffer = readFileSync(path);
  const response = await fetch(
    `${uploadBase}?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
      },
      body: buffer,
    },
  );
  const asset = await response.json();
  if (!response.ok)
    throw new Error(`上传 ${name} 失败：HTTP ${response.status}`);
  const digest = `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
  if (asset.size !== buffer.length || (asset.digest && asset.digest !== digest))
    throw new Error(`${name} 远端校验失败`);
  console.log(`Uploaded ${name}: ${asset.size} bytes, ${digest}`);
}
release = await request(`/releases/${release.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ draft: false, make_latest: "true" }),
});
console.log(`Published ${release.html_url}`);
for (const asset of release.assets)
  console.log(`${asset.name}: ${asset.browser_download_url}`);
