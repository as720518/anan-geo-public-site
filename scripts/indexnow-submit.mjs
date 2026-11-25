#!/usr/bin/env node
// 把改過的網址送給 IndexNow（api.indexnow.org，Bing、Yandex、Naver、Seznam 共用）。
// 部署完成、線上已經是新版之後再跑；金鑰檔在倉庫根目錄 <32 位十六進位>.txt，部署後位於 https://anangeo.com/<金鑰>.txt。
//
// 用法（在 repo 根目錄）：
//   node scripts/indexnow-submit.mjs --dry-run                       只印出要送的內容，不連網
//   node scripts/indexnow-submit.mjs https://anangeo.com/faq/ …      只送指定網址
//   node scripts/indexnow-submit.mjs --since 2026-11-25              送 sitemap 裡 lastmod ≥ 該日的網址
//   node scripts/indexnow-submit.mjs                                 送 sitemap.xml 全部 HTML 網址
//   --sitemap <檔案或網址>  預設讀 sitemap.xml；也可給 https://anangeo.com/sitemap.xml

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOST = "anangeo.com";
export const ENDPOINT = "https://api.indexnow.org/IndexNow";
const root = fileURLToPath(new URL("..", import.meta.url));

export function readKey(siteDir = root) {
  const files = readdirSync(siteDir).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (files.length !== 1) {
    throw new Error(`根目錄應剛好有一個 32 位 hex IndexNow 驗證檔，現在有 ${files.length} 個`);
  }
  const key = files[0].slice(0, -4);
  const body = readFileSync(join(siteDir, files[0]), "utf8").trim();
  if (body !== key) {
    throw new Error(`IndexNow 驗證檔內容與檔名不符：${files[0]}`);
  }
  return key;
}

export function buildPayload({ key, urls, host = HOST }) {
  for (const u of urls) {
    if (new URL(u).host !== host) {
      throw new Error(`非本站網址，拒絕送出：${u}`);
    }
  }
  return {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: [...new Set(urls)],
  };
}

export function sitemapUrls(xml, since) {
  const entries = [...xml.matchAll(/<url>(.*?)<\/url>/gs)]
    .map(([, u]) => ({
      loc: u.match(/<loc>(.*?)<\/loc>/)?.[1]?.trim(),
      lastmod: u.match(/<lastmod>(.*?)<\/lastmod>/)?.[1]?.trim(),
    }))
    .filter((e) => e.loc);
  if (!since) return entries.map((e) => e.loc);
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) throw new Error(`--since 日期無法解析：${since}`);
  return entries.filter((e) => e.lastmod && new Date(e.lastmod).getTime() >= t).map((e) => e.loc);
}

async function readSitemap(src) {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`讀取 sitemap 失敗：${src} → HTTP ${res.status}`);
    return res.text();
  }
  return readFileSync(src, "utf8");
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const [, v] = args.splice(i, 2);
    if (!v) throw new Error(`${flag} 後面必須指定值`);
    return v;
  };
  const dryRun = args.includes("--dry-run");
  if (dryRun) args.splice(args.indexOf("--dry-run"), 1);
  const since = take("--since");
  const sitemap = take("--sitemap") ?? join(root, "sitemap.xml");
  const unknown = args.filter((a) => a.startsWith("--"));
  if (unknown.length) throw new Error(`不認識的選項：${unknown.join(" ")}`);

  const urls = args.length ? args : sitemapUrls(await readSitemap(sitemap), since);
  if (!urls.length) {
    console.log("沒有要送出的網址。");
    return;
  }
  const payload = buildPayload({ key: readKey(), urls });

  if (dryRun) {
    console.log(`dry-run：不連網送出，共 ${payload.urlList.length} 條網址：`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(`IndexNow 回應 HTTP ${res.status}，已送出 ${payload.urlList.length} 條網址${text ? `\n${text}` : ""}`);
  if (res.status !== 200 && res.status !== 202) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
