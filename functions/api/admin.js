/**
 * Cloudflare Workers / Pages Function: /api/admin/*
 * 阿男 GEO 實戰工坊 — 純雲端手機後台 API（零外部依賴、純 Web Standard API）
 *
 * 端點：
 * - POST /api/admin/login        驗證 env.GEO_ADMIN_PASSWORD（固定時間比對）並簽發 HMAC-SHA256 HttpOnly Cookie
 * - POST /api/admin/logout       清除登入 Cookie
 * - GET  /api/admin/overview     讀取雲端 D1 名單列表、最新健檢紀錄、1,298 筆公開實測統計（未綁 D1 自動安全降級）
 * - POST /api/admin/audit        在雲端直接對指定客戶網址＋對手網址執行 GEO 初檢、存入 D1 audits 表並產出單頁 HTML 簡報
 * - GET  /api/admin/audit-report 依 id 讀取已儲存的單頁 HTML 簡報（供手機下載或預覽）
 */

import { runGeoBasicCheck, validatePublicUrl } from "./check.js";

const COOKIE_NAME = "anangeo_admin_session";
const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 天，方便手機 PWA 隨開即用
const MAX_BODY_BYTES = 32 * 1024;
const MAX_COMPETITORS = 3;

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
  const token = cookies[COOKIE_NAME];
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

function buildSinglePageAuditHtml({ clientName, targetReport, competitorReports, notes, generatedAt }) {
  const displayName = clientName || getHostLabel(targetReport.target_url);
  const lightTone = {
    green: { bg: "rgba(52,179,153,0.16)", fg: "#34b399", label: "綠燈良好" },
    yellow: { bg: "rgba(217,167,74,0.18)", fg: "#d9a74a", label: "黃燈待補強" },
    red: { bg: "rgba(226,109,90,0.18)", fg: "#e26d5a", label: "紅燈急需修復" },
  };
  const tTone = lightTone[targetReport.grade_light] || lightTone.red;

  const checkDefs = [
    { key: "robots", label: "01｜AI 爬蟲放行（robots.txt）" },
    { key: "llms", label: "02｜AI 導覽索引（llms.txt）" },
    { key: "homepage", label: "03｜官網結構與標籤（首頁 HTML / JSON-LD）" },
  ];

  const checkCardsHtml = checkDefs
    .map((def) => {
      const item = targetReport.checks?.[def.key];
      if (!item) return "";
      const tone = lightTone[item.light] || lightTone.red;
      const pct = Math.max(0, Math.min(100, Math.round((item.score / (item.max_score || 1)) * 100)));
      return `
      <div class="card check-card">
        <div class="row-between">
          <div class="check-title">${escapeHtml(def.label)}</div>
          <span class="pill" style="background:${tone.bg};color:${tone.fg};">${escapeHtml(LIGHT_LABELS[item.light] || item.light)}・${item.score} / ${item.max_score}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${tone.fg};"></div></div>
        <p class="check-summary">${escapeHtml(item.summary || "")}</p>
        ${item.recommendation ? `<p class="check-rec"><strong>建議動作：</strong>${escapeHtml(item.recommendation)}</p>` : ""}
      </div>`;
    })
    .join("");

  const compRowsHtml =
    competitorReports.length > 0
      ? competitorReports
          .map((comp) => {
            const diff = targetReport.score - comp.score;
            const diffText =
              diff > 0 ? `我方領先 +${diff} 分` : diff < 0 ? `落後對手 ${Math.abs(diff)} 分` : "與對手平手（0 分差）";
            const diffColor = diff > 0 ? "#34b399" : diff < 0 ? "#e26d5a" : "#d9a74a";
            return `
            <tr>
              <td><strong>${escapeHtml(getHostLabel(comp.target_url))}</strong><br><span class="small-muted">${escapeHtml(comp.target_url)}</span></td>
              <td class="mono">${comp.score} / 100</td>
              <td class="mono">${comp.checks?.robots?.score ?? 0} / ${comp.checks?.llms?.score ?? 0} / ${comp.checks?.homepage?.score ?? 0}</td>
              <td style="color:${diffColor};font-weight:700;">${escapeHtml(diffText)}</td>
            </tr>`;
          })
          .join("")
      : "";

  const pkSectionHtml =
    competitorReports.length > 0
      ? `
      <section class="section">
        <h2>同行對手即時 PK 對照</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>對手網站</th>
                <th>總分</th>
                <th>爬蟲 / llms / 結構</th>
                <th>與我方差距</th>
              </tr>
            </thead>
            <tbody>
              <tr class="row-self">
                <td><strong>${escapeHtml(displayName)}（我方）</strong><br><span class="small-muted">${escapeHtml(targetReport.target_url)}</span></td>
                <td class="mono"><strong>${targetReport.score} / 100</strong></td>
                <td class="mono">${targetReport.checks?.robots?.score ?? 0} / ${targetReport.checks?.llms?.score ?? 0} / ${targetReport.checks?.homepage?.score ?? 0}</td>
                <td style="color:#d9a74a;font-weight:700;">主測基準</td>
              </tr>
              ${compRowsHtml}
            </tbody>
          </table>
        </div>
      </section>`
      : "";

  const recsListHtml = (targetReport.recommendations || [])
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("");

  const notesHtml = notes
    ? `<div class="note-box"><strong>現場觀察備註：</strong>${escapeHtml(notes)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>GEO 公開頁健檢簡報｜${escapeHtml(displayName)}</title>
  <style>
    :root { --bg:#090e14; --surface:#111a24; --elev:#172330; --border:#243445; --ink:#ecf1f6; --muted:#9ab0c4; --brass:#d9a74a; --teal:#34b399; --coral:#e26d5a; }
    * { box-sizing:border-box; }
    body { margin:0; padding:24px 16px 48px; background:var(--bg); color:var(--ink); font-family:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif; line-height:1.68; }
    .wrap { max-width:860px; margin:0 auto; }
    .hero { background:linear-gradient(145deg,#131e2a,#0d151e); border:1px solid var(--border); border-top:3px solid var(--brass); border-radius:16px; padding:24px; margin-bottom:20px; }
    .eyebrow { font-size:12px; letter-spacing:0.08em; color:var(--brass); font-weight:700; margin-bottom:8px; }
    h1 { margin:0 0 8px; font-size:clamp(22px,4vw,30px); line-height:1.3; }
    h2 { margin:0 0 12px; font-size:18px; color:var(--ink); }
    .meta { color:var(--muted); font-size:13px; word-break:break-all; }
    .score-row { display:flex; flex-wrap:wrap; align-items:center; gap:16px; margin-top:18px; padding-top:18px; border-top:1px solid var(--border); }
    .big-score { font-size:48px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; color:var(--brass); }
    .big-score span { font-size:18px; color:var(--muted); font-weight:500; }
    .pill { display:inline-block; padding:4px 12px; border-radius:999px; font-size:13px; font-weight:700; }
    .section { margin-top:20px; }
    .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px; margin-bottom:12px; }
    .row-between { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
    .check-title { font-weight:700; font-size:15px; }
    .bar-track { height:8px; background:#1c2a38; border-radius:999px; overflow:hidden; margin:10px 0; }
    .bar-fill { height:100%; border-radius:999px; }
    .check-summary { margin:0; font-size:14px; color:var(--ink); }
    .check-rec { margin:8px 0 0; font-size:13px; color:#f3d28c; }
    .table-wrap { overflow-x:auto; background:var(--surface); border:1px solid var(--border); border-radius:14px; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th, td { padding:12px 14px; text-align:left; border-bottom:1px solid var(--border); vertical-align:top; }
    th { background:var(--elev); color:var(--muted); font-size:12px; letter-spacing:0.04em; }
    .row-self { background:rgba(217,167,74,0.08); }
    .mono { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-variant-numeric:tabular-nums; }
    .small-muted { font-size:12px; color:var(--muted); word-break:break-all; }
    .rec-list { margin:0; padding-left:20px; font-size:14px; }
    .rec-list li { margin-bottom:8px; }
    .note-box { margin-top:14px; padding:12px 14px; border-radius:10px; background:rgba(52,179,153,0.1); border:1px solid rgba(52,179,153,0.3); font-size:14px; }
    .cta { margin-top:22px; background:var(--elev); border:1px solid rgba(217,167,74,0.45); border-radius:14px; padding:18px; }
    .cta a { display:inline-block; margin-top:10px; padding:10px 18px; border-radius:10px; background:var(--brass); color:#090e14; font-weight:800; text-decoration:none; font-size:14px; }
    .footer { margin-top:20px; font-size:12px; color:var(--muted); }
    @media print { body { background:#ffffff; color:#0f172a; padding:0; } .hero,.card,.table-wrap,.cta { background:#ffffff; border-color:#cbd5e1; color:#0f172a; } .meta,.small-muted,.footer { color:#475569; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div class="eyebrow">阿男 GEO 實戰工坊・單頁公開健檢簡報</div>
      <h1>${escapeHtml(displayName)}｜GEO 基礎準備度健檢</h1>
      <div class="meta">檢測網址：${escapeHtml(targetReport.target_url)}　｜　檢測時間：${escapeHtml(generatedAt)}</div>
      <div class="score-row">
        <div class="big-score">${targetReport.score}<span> / 100</span></div>
        <div>
          <span class="pill" style="background:${tTone.bg};color:${tTone.fg};">${escapeHtml(tTone.label)}</span>
          <div style="margin-top:6px;font-size:14px;color:var(--ink);">${escapeHtml(targetReport.grade_label || "")}</div>
        </div>
      </div>
      ${notesHtml}
    </header>

    <section class="section">
      <h2>三項基礎設定實測明細</h2>
      ${checkCardsHtml}
    </section>

    ${pkSectionHtml}

    <section class="section">
      <h2>白話優先修復行動清單</h2>
      <div class="card">
        <ol class="rec-list">${recsListHtml}</ol>
      </div>
    </section>

    <section class="cta">
      <h2>下一步：進階 20 題跨平台無痕實測</h2>
      <p style="margin:0;font-size:14px;color:var(--muted);">
        本簡報針對公開頁的爬蟲放行、導覽索引與首頁結構做即時基礎初檢；如需實測 ChatGPT、Gemini、Perplexity 無痕新對話的實際點名與報價準確度，歡迎預約入門健檢（NT$3,800，30 天內升級改造可 100% 折抵）。
      </p>
      <a href="${LINE_URL}" target="_blank" rel="noopener">加入官方 LINE ${LINE_ID} 預約討論</a>
    </section>

    <footer class="footer">
      方法論說明：參照阿男 GEO 實戰工坊 1,298 筆跨引擎無痕實測基準（www.cccnan.art 結構健檢 41 → 89 分）建置。本報告僅呈現公開網頁實測結果，不保證固定搜尋排序或必被推薦；本工坊與 cccnan.art 客製紀念歌曲業務分開營運。
    </footer>
  </div>
</body>
</html>`;
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

    const safeSlug = getHostLabel(targetReport.target_url).replace(/[^a-z0-9.-]/gi, "-");
    return jsonResponse({
      ok: true,
      audit_id: auditId,
      stored_in_db: storedInDb,
      storage_notice: storedInDb
        ? "已存入雲端 D1 健檢紀錄。"
        : "目前未綁定 D1，本次簡報僅即時產生；請立即點擊「下載單頁 HTML 簡報」保存。",
      client_name: clientName || getHostLabel(targetReport.target_url),
      created_at: generatedAt,
      target: targetReport,
      competitors: competitorReports,
      competitors_summary: compactCompetitors,
      report_filename: `geo-audit-${safeSlug}-${generatedAt.slice(0, 10)}.html`,
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

  return jsonResponse({ ok: false, code: "NOT_FOUND", error: "找不到對應的雲端後台 API 路徑。" }, 404);
}
