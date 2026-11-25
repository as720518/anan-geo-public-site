/**
 * Cloudflare Workers / Pages Function: /api/admin/*
 * 阿男 GEO 實戰工坊 — 純雲端手機後台 API（零外部依賴、純 Web Standard API）
 *
 * 端點：
 * - POST /api/admin/login        驗證 env.GEO_ADMIN_PASSWORD（固定時間比對）並簽發 HMAC-SHA256 HttpOnly Cookie
 * - POST /api/admin/logout       清除登入 Cookie
 * - GET  /api/admin/overview     讀取雲端 D1 名單列表、最新健檢紀錄、1,298 筆公開實測統計（未綁 D1 自動安全降級）
 * - POST /api/admin/audit              在雲端直接對指定客戶網址＋對手網址執行 GEO 初檢、存入 D1 audits 表並產出單頁 HTML 簡報
 * - GET  /api/admin/audit-report       依 id 讀取已儲存的單頁 HTML 簡報（供手機下載或預覽）
 * - POST /api/admin/search-competitors 依關鍵字搜尋同業官網（優先 Serper Google+Places，無 Key 自動降級 DuckDuckGo HTML）
 */

import { runGeoBasicCheck, validatePublicUrl } from "./check.js";
import { buildBossReportHtml, buildBossReportFilename } from "../../admin/boss-report.js";

const COOKIE_NAME = "anangeo_admin_session";
const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 天，方便手機 PWA 隨開即用
const MAX_BODY_BYTES = 32 * 1024;
const MAX_COMPETITORS = 4;
const SEARCH_TIMEOUT_MS = 8000;
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 15;

const EXCLUDED_COMPETITOR_DOMAINS = new Set([
  // 社群平台
  "facebook.com",
  "fb.com",
  "instagram.com",
  "threads.net",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "line.me",
  // 論壇、百科、部落格
  "wikipedia.org",
  "ptt.cc",
  "dcard.tw",
  "mobile01.com",
  "pixnet.net",
  "medium.com",
  "vocus.cc",
  "yahoo.com",
  // 求職、搜尋引擎與黃頁目錄
  "104.com.tw",
  "1111.com.tw",
  "518.com.tw",
  "yes123.com.tw",
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "yelp.com",
  "tripadvisor.com",
  "iyp.com.tw",
]);

const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "com.tw",
  "org.tw",
  "net.tw",
  "edu.tw",
  "gov.tw",
  "idv.tw",
  "game.tw",
  "ebiz.tw",
  "club.tw",
  "mil.tw",
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "co.jp",
  "ne.jp",
  "or.jp",
  "ac.jp",
  "go.jp",
  "com.hk",
  "org.hk",
  "edu.hk",
  "gov.hk",
  "com.cn",
  "net.cn",
  "org.cn",
  "com.sg",
  "com.au",
  "co.kr",
  "com.my",
]);

const LINE_ID = "@250ruauk";
const LINE_URL = "https://line.me/R/ti/p/@250ruauk";

const LIGHT_LABELS = {
  green: "綠燈",
  yellow: "黃燈",
  red: "紅燈",
};

const FALLBACK_BASELINE = {
  brand_name: "阿男音樂｜張簡俊男",
  domain: "www.cccnan.art",
  window: "2026-09-23 ～ 2026-11-24（2026-11-25 案例包）",
  total_samples: 1298,
  test_days: 35,
  site_pages_current: 44,
  audit_score_before: 41,
  audit_score_after: 89,
  before_natural_mention: "0 / 22（0.0%）",
  after_natural_mention: "11/18–24：ChatGPT 50%｜Perplexity 50% 露出",
  before_line_accuracy: "0 / 10（0.0%）",
  after_line_accuracy: "ChatGPT 7/7・Perplexity 7/7（100%）",
  engines: [
    { id: "chatgpt", label: "ChatGPT", badge: "11/18–24 基準 7/14（50.0%）", after_metric: "7 / 14（50.0%）｜LINE 7/7" },
    { id: "perplexity", label: "Perplexity", badge: "情境 14/27（51.9%）｜50% 露出", after_metric: "情境 51.9%｜LINE 7/7" },
    { id: "gemini", label: "Gemini", badge: "11/18–24 基準 0/14｜LINE 3/7", after_metric: "四價對齊｜LINE 3/7" },
  ],
};

const CREATE_LEADS_SQL = `
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  target_url TEXT NOT NULL,
  competitor_url TEXT,
  score INTEGER,
  competitor_score INTEGER,
  grade_light TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL
)
`.trim();

const CREATE_AUDITS_SQL = `
CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT,
  target_url TEXT NOT NULL,
  target_score INTEGER NOT NULL,
  target_light TEXT NOT NULL,
  competitors_json TEXT,
  report_json TEXT,
  report_html TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
)
`.trim();

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      ...extraHeaders,
    },
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampText(val, maxLen) {
  if (typeof val !== "string") return "";
  const cleaned = val.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function toBase64Url(bytes) {
  let binary = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9_-]+$/.test(str)) {
    return null;
  }
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function constantTimeBytesEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function constantTimePasswordMatch(inputPassword, expectedPassword) {
  if (typeof inputPassword !== "string" || typeof expectedPassword !== "string") {
    return false;
  }
  if (!inputPassword || !expectedPassword) return false;
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(`anangeo-pw-v1:${inputPassword}`)),
    crypto.subtle.digest("SHA-256", encoder.encode(`anangeo-pw-v1:${expectedPassword}`)),
  ]);
  return constantTimeBytesEqual(new Uint8Array(hashA), new Uint8Array(hashB));
}

function getAdminPassword(env) {
  return typeof env?.GEO_ADMIN_PASSWORD === "string" ? env.GEO_ADMIN_PASSWORD.trim() : "";
}

function getSessionSecretMaterial(env) {
  const custom = typeof env?.GEO_ADMIN_SESSION_SECRET === "string" ? env.GEO_ADMIN_SESSION_SECRET.trim() : "";
  const base = custom || getAdminPassword(env);
  if (!base) return "";
  return `anangeo-admin-session-v1:${base}`;
}

async function importHmacKey(secretMaterial) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secretMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signSessionToken(env, nowSec = Math.floor(Date.now() / 1000)) {
  const secretMaterial = getSessionSecretMaterial(env);
  if (!secretMaterial) return null;
  const payload = {
    v: 1,
    sub: "admin",
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secretMaterial);
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

function parseCookies(cookieHeader) {
  const map = {};
  if (!cookieHeader) return map;
  for (const part of String(cookieHeader).split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) map[k] = v;
  }
  return map;
}

async function verifySessionRequest(request, env, nowSec = Math.floor(Date.now() / 1000)) {
  const secretMaterial = getSessionSecretMaterial(env);
  if (!secretMaterial) {
    return { ok: false, reason: "not_configured" };
  }
  const cookies = parseCookies(request.headers.get("cookie"));
  let token = cookies[COOKIE_NAME];
  if (!token) {
    const authHeader = request.headers.get("authorization") || "";
    const m = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authHeader.trim());
    if (m) token = m[1];
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing_cookie" };
  }
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx !== token.lastIndexOf(".")) {
    return { ok: false, reason: "malformed" };
  }
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  const providedSig = fromBase64Url(sigB64);
  if (!providedSig) {
    return { ok: false, reason: "invalid_sig" };
  }

  const key = await importHmacKey(secretMaterial);
  const expectedSigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const expectedSig = new Uint8Array(expectedSigBuf);
  if (!constantTimeBytesEqual(providedSig, expectedSig)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  const payloadBytes = fromBase64Url(payloadB64);
  if (!payloadBytes) {
    return { ok: false, reason: "bad_payload" };
  }
  try {
    const payload = JSON.parse(decoder.decode(payloadBytes));
    if (payload?.v !== 1 || payload?.sub !== "admin") {
      return { ok: false, reason: "bad_claims" };
    }
    if (!Number.isFinite(payload.exp) || payload.exp <= nowSec) {
      return { ok: false, reason: "expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "bad_json" };
  }
}

function buildCookieHeader(request, value, maxAgeSeconds) {
  const reqUrl = new URL(request.url);
  const isSecure = reqUrl.protocol === "https:";
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure) attrs.push("Secure");
  return attrs.join("; ");
}

async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  let text = "";
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, code: "INVALID_BODY", error: "無法讀取請求內容。" };
  }
  if (encoder.encode(text).byteLength > maxBytes) {
    return { ok: false, status: 413, code: "PAYLOAD_TOO_LARGE", error: "請求資料量超過上限。" };
  }
  if (!text.trim()) {
    return { ok: false, status: 400, code: "INVALID_JSON", error: "請求內容不可為空。" };
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, status: 400, code: "INVALID_JSON", error: "請求格式需為 JSON 物件。" };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, code: "INVALID_JSON", error: "JSON 格式解析失敗。" };
  }
}

async function loadBaselineStats(request, env) {
  try {
    if (env?.ASSETS && typeof env.ASSETS.fetch === "function") {
      const origin = new URL(request.url).origin;
      const resp = await env.ASSETS.fetch(new Request(`${origin}/data/case-cccnan.json`));
      if (resp.ok) {
        const raw = await resp.json();
        const m = raw?.metrics || {};
        const b = raw?.brand || {};
        const engines = Array.isArray(raw?.engines)
          ? raw.engines
              .filter((e) => e && e.id !== "overview")
              .slice(0, 4)
              .map((e) => ({
                id: String(e.id || ""),
                label: String(e.label || ""),
                badge: String(e.badge || ""),
                after_metric: String(e.after_metric || ""),
              }))
          : FALLBACK_BASELINE.engines;
        return {
          brand_name: b.name || FALLBACK_BASELINE.brand_name,
          domain: b.domain || FALLBACK_BASELINE.domain,
          window: b.window || FALLBACK_BASELINE.window,
          total_samples: Number(m.total_samples) || FALLBACK_BASELINE.total_samples,
          test_days: Number(m.test_days) || FALLBACK_BASELINE.test_days,
          site_pages_current: Number(m.site_pages_current) || FALLBACK_BASELINE.site_pages_current,
          audit_score_before: Number(m.audit_score_before) || FALLBACK_BASELINE.audit_score_before,
          audit_score_after: Number(m.audit_score_after) || FALLBACK_BASELINE.audit_score_after,
          before_natural_mention: m.before_natural_mention || FALLBACK_BASELINE.before_natural_mention,
          after_natural_mention: m.after_natural_mention || FALLBACK_BASELINE.after_natural_mention,
          before_line_accuracy: m.before_line_accuracy || FALLBACK_BASELINE.before_line_accuracy,
          after_line_accuracy: m.after_line_accuracy || FALLBACK_BASELINE.after_line_accuracy,
          engines,
        };
      }
    }
  } catch {
    // 靜默降級回內建基準
  }
  return { ...FALLBACK_BASELINE };
}

async function ensureAdminTables(db) {
  await db.prepare(CREATE_LEADS_SQL).run();
  await db.prepare(CREATE_AUDITS_SQL).run();
}

function getHostLabel(urlHref) {
  try {
    return new URL(urlHref).hostname;
  } catch {
    return String(urlHref || "");
  }
}

export function extractRootDomain(hostname) {
  const clean = String(hostname || "")
    .toLowerCase()
    .trim()
    .replace(/\.+$/, "");
  if (!clean) return "";
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 2) return clean;
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }
  return lastTwo;
}

function normalizeExcludeDomain(rawExclude) {
  if (typeof rawExclude !== "string") return null;
  const trimmed = rawExclude.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    if (!host) return null;
    return { host, rootDomain: extractRootDomain(host) };
  } catch {
    const host = trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, "")
      .replace(/\.+$/, "");
    if (!host) return null;
    return { host, rootDomain: extractRootDomain(host) };
  }
}

function isExcludedCompetitorHost(hostname, excludeInfo) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.+$/, "");
  if (!host) return true;
  for (const blocked of EXCLUDED_COMPETITOR_DOMAINS) {
    if (host === blocked || host.endsWith(`.${blocked}`)) {
      return true;
    }
  }
  if (excludeInfo) {
    const rootDomain = extractRootDomain(host);
    if (
      (excludeInfo.rootDomain && rootDomain === excludeInfo.rootDomain) ||
      host === excludeInfo.host ||
      host.endsWith(`.${excludeInfo.host}`)
    ) {
      return true;
    }
  }
  return false;
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function stripHtmlTags(str) {
  return decodeHtmlEntities(
    String(str || "")
      .replace(/<\s*(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapDuckDuckGoUrl(rawHref) {
  const decodedHref = decodeHtmlEntities(String(rawHref || "").trim());
  if (!decodedHref) return "";
  let fullHref = decodedHref;
  if (fullHref.startsWith("//")) {
    fullHref = `https:${fullHref}`;
  } else if (fullHref.startsWith("/")) {
    fullHref = `https://duckduckgo.com${fullHref}`;
  }
  try {
    const parsed = new URL(fullHref);
    if (
      (parsed.hostname === "duckduckgo.com" || parsed.hostname.endsWith(".duckduckgo.com")) &&
      parsed.pathname.startsWith("/l/")
    ) {
      const target = parsed.searchParams.get("uddg");
      return target ? target.trim() : "";
    }
    return parsed.href;
  } catch {
    return "";
  }
}

export function parseDuckDuckGoHtml(htmlText) {
  const items = [];
  const html = String(htmlText || "");
  const anchorRe = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const anchorReAlt = /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const matches = [];
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    matches.push({ index: m.index, end: anchorRe.lastIndex, href: m[1], titleHtml: m[2] });
  }
  if (matches.length === 0) {
    while ((m = anchorReAlt.exec(html)) !== null) {
      matches.push({ index: m.index, end: anchorReAlt.lastIndex, href: m[1], titleHtml: m[2] });
    }
  }

  for (let i = 0; i < matches.length; i += 1) {
    const cur = matches[i];
    const nextIdx = i + 1 < matches.length ? matches[i + 1].index : Math.min(html.length, cur.end + 1800);
    const windowSlice = html.slice(cur.end, nextIdx);
    const snippetMatch = /class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i.exec(
      windowSlice
    );
    const url = unwrapDuckDuckGoUrl(cur.href);
    const title = stripHtmlTags(cur.titleHtml);
    const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]) : "";
    if (url) {
      items.push({ title, url, snippet, source: "duckduckgo_html" });
    }
  }
  return items;
}

function collectFilteredCompetitors(rawItems, { excludeInfo, limit, seenRootDomains, results }) {
  let filteredOutCount = 0;
  for (const item of rawItems) {
    if (results.length >= limit) break;
    const rawUrl = typeof item?.url === "string" ? item.url.trim() : "";
    if (!rawUrl) {
      filteredOutCount += 1;
      continue;
    }
    const check = validatePublicUrl(rawUrl);
    if (!check.ok) {
      filteredOutCount += 1;
      continue;
    }
    const host = check.url.hostname.toLowerCase().replace(/\.+$/, "");
    if (isExcludedCompetitorHost(host, excludeInfo)) {
      filteredOutCount += 1;
      continue;
    }
    const rootDomain = extractRootDomain(host);
    if (!rootDomain || seenRootDomains.has(rootDomain)) {
      filteredOutCount += 1;
      continue;
    }
    seenRootDomains.add(rootDomain);
    results.push({
      title: clampText(item.title || rootDomain, 100) || rootDomain,
      url: check.url.href,
      domain: rootDomain,
      snippet: clampText(item.snippet || "", 200),
      source: String(item.source || "web"),
    });
  }
  return filteredOutCount;
}

async function fetchJsonWithTimeout(fetchFn, url, init, timeoutMs = SEARCH_TIMEOUT_MS) {
  const signal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  const resp = await fetchFn(url, { ...init, ...(signal ? { signal } : {}) });
  if (!resp.ok) {
    return { ok: false, status: resp.status, data: null };
  }
  const data = await resp.json();
  return { ok: true, status: resp.status, data };
}

async function searchCompetitorsViaSerper(query, serperKey, { fetchFn, excludeInfo, limit }) {
  const results = [];
  const seenRootDomains = new Set();
  let filteredOutCount = 0;
  let anySucceeded = false;

  // 1. 主要 Google 搜尋（台灣繁中）
  try {
    const searchRes = await fetchJsonWithTimeout(
      fetchFn,
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          gl: "tw",
          hl: "zh-tw",
          num: 15,
        }),
      },
      SEARCH_TIMEOUT_MS
    );
    if (searchRes.ok && searchRes.data) {
      anySucceeded = true;
      const organic = Array.isArray(searchRes.data.organic) ? searchRes.data.organic : [];
      const mapped = organic.map((o) => ({
        title: o?.title || "",
        url: o?.link || "",
        snippet: o?.snippet || "",
        source: "google_organic",
      }));
      filteredOutCount += collectFilteredCompetitors(mapped, {
        excludeInfo,
        limit,
        seenRootDomains,
        results,
      });
    }
  } catch {
    // 交由下方 places 或降級流程處理
  }

  // 2. 視需要補查 Google Maps 商家官網（當有機結果未達 limit 時）
  if (results.length < limit) {
    try {
      const placesRes = await fetchJsonWithTimeout(
        fetchFn,
        "https://google.serper.dev/places",
        {
          method: "POST",
          headers: {
            "X-API-KEY": serperKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: query,
            gl: "tw",
            hl: "zh-tw",
            num: 15,
          }),
        },
        SEARCH_TIMEOUT_MS
      );
      if (placesRes.ok && placesRes.data) {
        anySucceeded = true;
        const places = Array.isArray(placesRes.data.places) ? placesRes.data.places : [];
        const mappedPlaces = places
          .filter((p) => typeof p?.website === "string" && p.website.trim())
          .map((p) => {
            const parts = [];
            if (p.category) parts.push(String(p.category));
            if (p.address) parts.push(String(p.address));
            if (p.rating != null) parts.push(`評分 ${p.rating}`);
            return {
              title: p.title || p.name || "",
              url: p.website,
              snippet: parts.join("｜"),
              source: "google_places",
            };
          });
        filteredOutCount += collectFilteredCompetitors(mappedPlaces, {
          excludeInfo,
          limit,
          seenRootDomains,
          results,
        });
      }
    } catch {
      // places 失敗不影響已取得的有機結果
    }
  }

  return {
    ok: anySucceeded,
    results,
    filteredOutCount,
  };
}

async function searchCompetitorsViaDuckDuckGo(query, { fetchFn, excludeInfo, limit }) {
  const results = [];
  const seenRootDomains = new Set();
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=tw-tzh`;

  try {
    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(SEARCH_TIMEOUT_MS)
        : undefined;
    const resp = await fetchFn(ddgUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.5",
      },
      ...(signal ? { signal } : {}),
    });

    if (!resp.ok) {
      return {
        ok: false,
        degraded: true,
        results: [],
        filteredOutCount: 0,
        warning: `免 Key 備用搜尋暫時無法取得結果（HTTP ${resp.status}），建議於 Cloudflare 設定 SERPER_API_KEY 或直接手動貼上對手網址。`,
      };
    }

    const html = await resp.text();
    const rawItems = parseDuckDuckGoHtml(html);
    const filteredOutCount = collectFilteredCompetitors(rawItems, {
      excludeInfo,
      limit,
      seenRootDomains,
      results,
    });

    const looksChallenge = rawItems.length === 0 && /anomaly|captcha|bot/i.test(html);
    return {
      ok: true,
      degraded: looksChallenge,
      results,
      filteredOutCount,
      warning: looksChallenge
        ? "免 Key 備用搜尋目前受到流量驗證限制，建議於 Cloudflare 設定 SERPER_API_KEY 取得穩定結果，或直接手動輸入對手網址。"
        : null,
    };
  } catch (err) {
    const isTimeout =
      err?.name === "TimeoutError" ||
      err?.name === "AbortError" ||
      /timeout|aborted/i.test(String(err?.message || ""));
    return {
      ok: false,
      degraded: true,
      results: [],
      filteredOutCount: 0,
      warning: isTimeout
        ? "免 Key 備用搜尋逾時（超過 8 秒），建議於 Cloudflare 設定 SERPER_API_KEY 以獲得穩定高速搜尋，或直接手動輸入對手網址。"
        : "免 Key 備用搜尋暫時連線失敗，請稍後再試或改於下方手動輸入對手網址。",
    };
  }
}

function buildSinglePageAuditHtml({ clientName, targetReport, competitorReports, notes, generatedAt }) {
  return buildBossReportHtml({
    clientName,
    targetReport,
    competitorReports,
    notes,
    generatedAt,
  });
}

export async function onRequest(context) {
  const { request, env = {} } = context || {};
  const fetchFn = typeof context?.fetch === "function" ? context.fetch : globalThis.fetch;
  const reqUrl = new URL(request.url);
  const pathname = reqUrl.pathname.replace(/\/+$/, "") || "/api/admin";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // 0. GET /api/admin/session（永遠回 200，讓前端檢查登入狀態不產生瀏覽器 401 console 雜訊）
  if (pathname === "/api/admin/session") {
    if (request.method !== "GET") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "此端點僅支援 GET。" }, 405);
    }
    const authCheck = await verifySessionRequest(request, env);
    return jsonResponse({
      ok: true,
      authenticated: authCheck.ok,
      password_configured: Boolean(getAdminPassword(env)),
      db_connected: Boolean(env?.DB && typeof env.DB.prepare === "function"),
    });
  }

  // 1. POST /api/admin/login
  if (pathname === "/api/admin/login") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "登入端點僅支援 POST。" }, 405);
    }

    const configuredPw = getAdminPassword(env);
    if (!configuredPw) {
      return jsonResponse(
        {
          ok: false,
          code: "ADMIN_PASSWORD_NOT_CONFIGURED",
          error:
            "雲端後台尚未設定管理密碼。請前往 Cloudflare Workers & Pages 後台 → Settings → Variables and Secrets 新增 Secret 變數 GEO_ADMIN_PASSWORD 後重新部署。",
        },
        503
      );
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
    }

    const inputPw = typeof parsed.data.password === "string" ? parsed.data.password : "";
    const matched = await constantTimePasswordMatch(inputPw, configuredPw);
    if (!matched) {
      return jsonResponse(
        {
          ok: false,
          code: "INVALID_PASSWORD",
          error: "管理密碼不正確，請重新確認。",
        },
        401
      );
    }

    const token = await signSessionToken(env);
    const setCookie = buildCookieHeader(request, token, SESSION_TTL_SECONDS);
    return jsonResponse(
      {
        ok: true,
        authenticated: true,
        db_connected: Boolean(env?.DB && typeof env.DB.prepare === "function"),
        message: "登入成功。",
      },
      200,
      { "Set-Cookie": setCookie }
    );
  }

  // 2. POST /api/admin/logout
  if (pathname === "/api/admin/logout") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "登出端點僅支援 POST。" }, 405);
    }
    const clearCookie = buildCookieHeader(request, "", 0);
    return jsonResponse(
      { ok: true, authenticated: false, message: "已安全登出。" },
      200,
      { "Set-Cookie": clearCookie }
    );
  }

  // 以下端點全部需要有效登入 Session
  const auth = await verifySessionRequest(request, env);
  if (!auth.ok) {
    return jsonResponse(
      {
        ok: false,
        code: "UNAUTHORIZED",
        error: "請先輸入管理密碼登入雲端後台。",
        password_configured: Boolean(getAdminPassword(env)),
      },
      401
    );
  }

  // 3. GET /api/admin/overview
  if (pathname === "/api/admin/overview") {
    if (request.method !== "GET") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "此端點僅支援 GET。" }, 405);
    }

    const baseline = await loadBaselineStats(request, env);
    const hasDb = Boolean(env?.DB && typeof env.DB.prepare === "function");

    if (!hasDb) {
      return jsonResponse({
        ok: true,
        authenticated: true,
        db_connected: false,
        db_notice:
          "目前尚未綁定 Cloudflare D1 資料庫（DB）。以下顯示 1,298 筆公開基準統計；您仍可直接用手機做即時健檢與下載單頁簡報，於 Cloudflare 後台綁定 D1（變數名 DB）後即自動啟用雲端名單與歷史紀錄儲存。",
        config_status: {
          password_configured: true,
          db_bound: false,
          resend_configured: Boolean(typeof env?.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim()),
          serper_configured: Boolean(typeof env?.SERPER_API_KEY === "string" && env.SERPER_API_KEY.trim()),
        },
        kpi: {
          leads_count: 0,
          audits_count: 0,
          baseline_samples: baseline.total_samples,
          baseline_score_before: baseline.audit_score_before,
          baseline_score_after: baseline.audit_score_after,
        },
        baseline,
        leads: [],
        audits: [],
        server_time: new Date().toISOString(),
      });
    }

    try {
      await ensureAdminTables(env.DB);
      const [leadCountRow, auditCountRow, leadsRes, auditsRes] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS cnt FROM leads").first(),
        env.DB.prepare("SELECT COUNT(*) AS cnt FROM audits").first(),
        env.DB.prepare(
          `SELECT id, email, target_url, competitor_url, score, competitor_score, grade_light, created_at
           FROM leads ORDER BY id DESC LIMIT 50`
        ).all(),
        env.DB.prepare(
          `SELECT id, client_name, target_url, target_score, target_light, competitors_json, notes, created_at
           FROM audits ORDER BY id DESC LIMIT 30`
        ).all(),
      ]);

      const leads = Array.isArray(leadsRes?.results) ? leadsRes.results : [];
      const audits = (Array.isArray(auditsRes?.results) ? auditsRes.results : []).map((row) => {
        let competitors = [];
        try {
          const parsed = JSON.parse(row.competitors_json || "[]");
          if (Array.isArray(parsed)) competitors = parsed;
        } catch {}
        return {
          id: row.id,
          client_name: row.client_name || "",
          target_url: row.target_url,
          target_score: row.target_score,
          target_light: row.target_light,
          competitors_count: competitors.length,
          competitors,
          notes: row.notes || "",
          created_at: row.created_at,
        };
      });

      return jsonResponse({
        ok: true,
        authenticated: true,
        db_connected: true,
        db_notice: null,
        config_status: {
          password_configured: true,
          db_bound: true,
          resend_configured: Boolean(typeof env?.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim()),
          serper_configured: Boolean(typeof env?.SERPER_API_KEY === "string" && env.SERPER_API_KEY.trim()),
        },
        kpi: {
          leads_count: Number(leadCountRow?.cnt || 0),
          audits_count: Number(auditCountRow?.cnt || 0),
          baseline_samples: baseline.total_samples,
          baseline_score_before: baseline.audit_score_before,
          baseline_score_after: baseline.audit_score_after,
        },
        baseline,
        leads,
        audits,
        server_time: new Date().toISOString(),
      });
    } catch {
      return jsonResponse({
        ok: true,
        authenticated: true,
        db_connected: false,
        db_notice:
          "偵測到 D1 綁定但暫時無法完成查詢，已自動切換為唯讀基準模式（1,298 筆公開統計）。請於 Cloudflare 後台檢查 DB 綁定狀態。",
        config_status: {
          password_configured: true,
          db_bound: false,
          resend_configured: Boolean(typeof env?.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim()),
          serper_configured: Boolean(typeof env?.SERPER_API_KEY === "string" && env.SERPER_API_KEY.trim()),
        },
        kpi: {
          leads_count: 0,
          audits_count: 0,
          baseline_samples: baseline.total_samples,
          baseline_score_before: baseline.audit_score_before,
          baseline_score_after: baseline.audit_score_after,
        },
        baseline,
        leads: [],
        audits: [],
        server_time: new Date().toISOString(),
      });
    }
  }

  // 4. POST /api/admin/audit
  if (pathname === "/api/admin/audit") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "健檢端點僅支援 POST。" }, 405);
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
    }

    const body = parsed.data;
    const targetCheck = validatePublicUrl(body.target_url);
    if (!targetCheck.ok) {
      return jsonResponse({ ok: false, code: targetCheck.code, error: targetCheck.error }, 400);
    }

    // 整理對手網址（支援 competitor_urls 陣列或單一 competitor_url 字串，最多 3 個）
    const rawCompetitors = [];
    if (Array.isArray(body.competitor_urls)) {
      for (const item of body.competitor_urls) {
        if (typeof item === "string" && item.trim()) rawCompetitors.push(item.trim());
      }
    } else if (typeof body.competitor_urls === "string" && body.competitor_urls.trim()) {
      for (const item of body.competitor_urls.split(/[\r\n,]+/)) {
        if (item.trim()) rawCompetitors.push(item.trim());
      }
    }
    if (typeof body.competitor_url === "string" && body.competitor_url.trim()) {
      rawCompetitors.push(body.competitor_url.trim());
    }

    const uniqueCompUrls = [];
    const seenHref = new Set([targetCheck.url.href]);
    for (const rawComp of rawCompetitors.slice(0, MAX_COMPETITORS + 2)) {
      if (uniqueCompUrls.length >= MAX_COMPETITORS) break;
      const compCheck = validatePublicUrl(rawComp);
      if (!compCheck.ok) {
        return jsonResponse(
          { ok: false, code: compCheck.code, error: `對手網址無效（${rawComp}）：${compCheck.error}` },
          400
        );
      }
      if (!seenHref.has(compCheck.url.href)) {
        seenHref.add(compCheck.url.href);
        uniqueCompUrls.push(compCheck.url);
      }
    }

    const clientName = clampText(body.client_name, 80);
    const notes = clampText(body.notes, 300);

    let targetReport;
    let competitorReports = [];
    try {
      const results = await Promise.all([
        runGeoBasicCheck(targetCheck.url, fetchFn),
        ...uniqueCompUrls.map((u) => runGeoBasicCheck(u, fetchFn)),
      ]);
      targetReport = results[0];
      competitorReports = results.slice(1);
    } catch {
      return jsonResponse(
        { ok: false, code: "AUDIT_FAILED", error: "雲端健檢連線暫時失敗，請稍後再試。" },
        502
      );
    }

    const generatedAt = new Date().toISOString();
    const reportHtml = buildSinglePageAuditHtml({
      clientName,
      targetReport,
      competitorReports,
      notes,
      generatedAt,
    });

    const compactCompetitors = competitorReports.map((c) => ({
      target_url: c.target_url,
      score: c.score,
      grade_light: c.grade_light,
      diff: targetReport.score - c.score,
      robots_score: c.checks?.robots?.score ?? 0,
      llms_score: c.checks?.llms?.score ?? 0,
      homepage_score: c.checks?.homepage?.score ?? 0,
    }));

    let storedInDb = false;
    let auditId = null;
    if (env?.DB && typeof env.DB.prepare === "function") {
      try {
        await ensureAdminTables(env.DB);
        const ins = await env.DB.prepare(
          `INSERT INTO audits (client_name, target_url, target_score, target_light, competitors_json, report_json, report_html, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            clientName || getHostLabel(targetReport.target_url),
            targetReport.target_url,
            targetReport.score,
            targetReport.grade_light,
            JSON.stringify(compactCompetitors),
            JSON.stringify({ target: targetReport, competitors: competitorReports }),
            reportHtml,
            notes,
            generatedAt
          )
          .run();
        storedInDb = true;
        auditId = ins?.meta?.last_row_id ?? null;
      } catch {
        storedInDb = false;
      }
    }

    const reportFilename = buildBossReportFilename({
      clientName,
      targetUrl: targetReport.target_url,
      competitorCount: competitorReports.length,
      generatedAt,
    });
    return jsonResponse({
      ok: true,
      audit_id: auditId,
      stored_in_db: storedInDb,
      storage_notice: storedInDb
        ? "已存入雲端 D1 健檢紀錄，可一鍵下載超炫老闆簡報傳進 LINE。"
        : "目前未綁定 D1，本次簡報僅即時產生；請立即點擊「下載超炫老闆簡報（HTML）」保存。",
      client_name: clientName || getHostLabel(targetReport.target_url),
      created_at: generatedAt,
      target: targetReport,
      competitors: competitorReports,
      competitors_summary: compactCompetitors,
      report_filename: reportFilename,
      report_html: reportHtml,
    });
  }

  // 5. GET /api/admin/audit-report?id=<id>
  if (pathname === "/api/admin/audit-report") {
    if (request.method !== "GET") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "此端點僅支援 GET。" }, 405);
    }
    if (!env?.DB || typeof env.DB.prepare !== "function") {
      return jsonResponse(
        { ok: false, code: "DB_NOT_BOUND", error: "尚未綁定 D1 資料庫，無法讀取歷史簡報。" },
        404
      );
    }
    const idNum = Number(reqUrl.searchParams.get("id"));
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return jsonResponse({ ok: false, code: "INVALID_ID", error: "請提供有效的健檢編號。" }, 400);
    }
    try {
      await ensureAdminTables(env.DB);
      const row = await env.DB.prepare(
        "SELECT id, client_name, target_url, report_html, created_at FROM audits WHERE id = ?"
      )
        .bind(idNum)
        .first();
      if (!row || !row.report_html) {
        return jsonResponse({ ok: false, code: "NOT_FOUND", error: "找不到對應的歷史簡報。" }, 404);
      }
      const download = reqUrl.searchParams.get("download") === "1";
      const safeHost = getHostLabel(row.target_url).replace(/[^a-z0-9.-]/gi, "-");
      const filename = `geo-audit-${safeHost}-${String(row.created_at || "").slice(0, 10) || row.id}.html`;
      const headers = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      };
      if (download) {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      }
      return new Response(row.report_html, { status: 200, headers });
    } catch {
      return jsonResponse({ ok: false, code: "DB_ERROR", error: "讀取歷史簡報時發生暫時性錯誤。" }, 500);
    }
  }

  // 6. POST /api/admin/search-competitors
  if (pathname === "/api/admin/search-competitors") {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED", error: "對手搜尋端點僅支援 POST。" }, 405);
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
    }

    const body = parsed.data;
    const query = clampText(typeof body.query === "string" ? body.query : "", 120);
    if (!query) {
      return jsonResponse(
        { ok: false, code: "MISSING_QUERY", error: "請輸入要搜尋的關鍵字（例如：高雄 牙醫）。" },
        400
      );
    }

    const excludeInfo = normalizeExcludeDomain(body.exclude_domain);
    const rawLimit = Number(body.limit);
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1
        ? Math.min(MAX_SEARCH_LIMIT, Math.floor(rawLimit))
        : DEFAULT_SEARCH_LIMIT;

    const serperKey = typeof env?.SERPER_API_KEY === "string" ? env.SERPER_API_KEY.trim() : "";

    if (serperKey) {
      const serperRes = await searchCompetitorsViaSerper(query, serperKey, {
        fetchFn,
        excludeInfo,
        limit,
      });
      if (serperRes.ok) {
        return jsonResponse({
          ok: true,
          query,
          engine: "serper",
          needs_serper_key: false,
          degraded: false,
          notice: null,
          warning:
            serperRes.results.length === 0
              ? "未找到符合條件的獨立同業官網（已自動排除社群與黃頁目錄），建議換組更精準的地區＋服務關鍵字。"
              : null,
          filtered_out_count: serperRes.filteredOutCount,
          total: serperRes.results.length,
          results: serperRes.results,
        });
      }

      // Serper 暫時異常時安全降級至 DuckDuckGo，不回傳 500
      const fallbackRes = await searchCompetitorsViaDuckDuckGo(query, {
        fetchFn,
        excludeInfo,
        limit,
      });
      return jsonResponse({
        ok: true,
        query,
        engine: "duckduckgo_fallback",
        needs_serper_key: false,
        degraded: true,
        notice: "Serper 搜尋暫時無法回應，已自動切換為免 Key 備用搜尋。",
        warning: fallbackRes.warning,
        filtered_out_count: fallbackRes.filteredOutCount,
        total: fallbackRes.results.length,
        results: fallbackRes.results,
      });
    }

    // 未設定 SERPER_API_KEY：安全降級呼叫 DuckDuckGo HTML 公開搜尋
    const ddgRes = await searchCompetitorsViaDuckDuckGo(query, {
      fetchFn,
      excludeInfo,
      limit,
    });
    return jsonResponse({
      ok: true,
      query,
      engine: "duckduckgo_fallback",
      needs_serper_key: true,
      degraded: Boolean(ddgRes.degraded),
      notice:
        "目前尚未設定 SERPER_API_KEY，已自動切換免 Key 備用搜尋；於 Cloudflare 設定 SERPER_API_KEY Secret 可啟用 Google 搜尋＋地圖商家官網加速。",
      warning:
        ddgRes.warning ||
        (ddgRes.results.length === 0
          ? "目前免 Key 備用搜尋未抓到符合條件的獨立同業官網，建議調整關鍵字或改於下方手動貼上對手網址。"
          : null),
      filtered_out_count: ddgRes.filteredOutCount,
      total: ddgRes.results.length,
      results: ddgRes.results,
    });
  }

  return jsonResponse({ ok: false, code: "NOT_FOUND", error: "找不到對應的雲端後台 API 路徑。" }, 404);
}
