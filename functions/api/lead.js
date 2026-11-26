/**
 * Cloudflare Workers / Pages Function: POST /api/lead
 * 阿男 GEO 實戰工坊 — Email 解鎖完整初檢（含對手 PK）報告、Resend 自動追單三部曲與推廣名單收集（純標準 Web API、零外部依賴）
 *
 * 行為規格：
 * - 支援 POST /api/lead 與 OPTIONS CORS preflight（其他方法回 405）
 * - 嚴格驗證：Email 格式、consent === true、target_url（與選填 competitor_url）公開網址規則、分數摘要與負載大小上限（<= 32 KB）
 * - 若設定 env.RESEND_API_KEY：
 *   1. 第 1 封（當下立即寄出）：繁中「GEO 基礎初檢與對手差距報告」（含紅綠燈明細、修復建議、退訂說明與 LINE @250ruauk）
 *   2. 第 2 封（scheduled_at = +72 小時／第 3 天）：《真實破案實錄：為什麼網站有做傳統 SEO，ChatGPT 與 Gemini 還是推薦對手或報錯價格？》
 *   3. 第 3 封（scheduled_at = +168 小時／第 7 天）：《專屬健檢折抵提醒：NT$3,800 深度 20 題健檢 30 天內可 100% 折抵改造費》
 *   4. 若設定 env.RESEND_AUDIENCE_ID：新增聯絡人至 Resend Audience
 *   5. 若設定 env.ADMIN_NOTIFY_EMAIL：同步寄出新名單通知給管理員
 * - 排程信失敗獨立容錯，絕不影響第 0 天即時信與前端解鎖；若未設定 env.RESEND_API_KEY 或 Resend 暫時異常，仍回傳 HTTP 200 unlocked: true，絕不洩漏金鑰
 */

import { validatePublicUrl } from "./check.js";
import {
  sanitizeConversionDiagnosis,
  sanitizeWeeklyPrescription,
  formatPrescriptionPlainText,
} from "../lib/conversion-wuxing.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const MAX_BODY_BYTES = 32 * 1024;
const RESEND_TIMEOUT_MS = 8000;
const DEFAULT_FROM = "阿男 GEO 實戰工坊 <noreply@cccnan.art>";
const SITE_URL = "https://anangeo.com";
const LINE_ID = "@250ruauk";
const LINE_URL = "https://line.me/R/ti/p/@250ruauk";

export const FOLLOWUP_DELAY_HOURS = {
  day3: 72,
  day7: 168,
};

const LIGHT_LABELS = {
  green: "綠燈",
  yellow: "黃燈",
  red: "紅燈",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...CORS_HEADERS,
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

function stripHeaderBreaks(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

export function validateEmail(rawInput) {
  if (typeof rawInput !== "string") {
    return { ok: false, code: "INVALID_EMAIL", error: "請輸入有效的 Email 信箱。" };
  }
  if (/[\r\n]/.test(rawInput)) {
    return { ok: false, code: "INVALID_EMAIL", error: "Email 格式包含無效字元，請重新確認。" };
  }
  const normalized = rawInput.trim().toLowerCase();
  if (!normalized || normalized.length > 254) {
    return { ok: false, code: "INVALID_EMAIL", error: "請輸入有效的 Email 信箱（長度不超過 254 字元）。" };
  }
  const atIdx = normalized.indexOf("@");
  if (atIdx <= 0 || atIdx !== normalized.lastIndexOf("@")) {
    return { ok: false, code: "INVALID_EMAIL", error: "Email 格式不正確，請確認是否包含 @ 與完整網域。" };
  }
  const localPart = normalized.slice(0, atIdx);
  const domainPart = normalized.slice(atIdx + 1);
  if (
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domainPart.length > 253 ||
    domainPart.includes("..") ||
    !domainPart.includes(".")
  ) {
    return { ok: false, code: "INVALID_EMAIL", error: "Email 格式不正確，請輸入常用且可收信的信箱。" };
  }
  const emailRe = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!emailRe.test(normalized)) {
    return { ok: false, code: "INVALID_EMAIL", error: "Email 格式不正確，請重新確認。" };
  }
  const tld = domainPart.split(".").pop() || "";
  if (tld.length < 2 || !/^[a-z]{2,63}$/.test(tld)) {
    return { ok: false, code: "INVALID_EMAIL", error: "Email 網域格式不正確，請重新確認。" };
  }
  return { ok: true, email: normalized };
}

async function readJsonBodyLimited(request, maxBytes) {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return {
        ok: false,
        status: 413,
        code: "PAYLOAD_TOO_LARGE",
        error: "送出資料量超過上限，請重新執行基礎初檢後再試。",
      };
    }
  }

  let rawText = "";
  try {
    if (request.body && typeof request.body.getReader === "function") {
      const reader = request.body.getReader();
      const chunks = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value || value.byteLength === 0) continue;
          total += value.byteLength;
          if (total > maxBytes) {
            try {
              await reader.cancel();
            } catch {}
            return {
              ok: false,
              status: 413,
              code: "PAYLOAD_TOO_LARGE",
              error: "送出資料量超過上限，請重新執行基礎初檢後再試。",
            };
          }
          chunks.push(value);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {}
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        combined.set(c, offset);
        offset += c.byteLength;
      }
      rawText = new TextDecoder("utf-8", { fatal: false }).decode(combined);
    } else {
      rawText = await request.text();
      if (new TextEncoder().encode(rawText).byteLength > maxBytes) {
        return {
          ok: false,
          status: 413,
          code: "PAYLOAD_TOO_LARGE",
          error: "送出資料量超過上限，請重新執行基礎初檢後再試。",
        };
      }
    }
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_BODY",
      error: "無法讀取請求內容，請稍後再試。",
    };
  }

  if (!rawText.trim()) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_JSON",
      error: "請求內容不可為空。",
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_JSON",
      error: "請求格式錯誤，請傳送有效的 JSON 資料。",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_JSON",
      error: "請求資料必須為 JSON 物件。",
    };
  }

  return { ok: true, data: parsed };
}

function parseOptionalScore(rawVal, fieldName) {
  if (rawVal === undefined || rawVal === null || rawVal === "") {
    return { ok: true, value: null };
  }
  const n = Number(rawVal);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return {
      ok: false,
      code: "INVALID_SUMMARY",
      error: `${fieldName} 分數格式無效（需介於 0 到 100 之間）。`,
    };
  }
  return { ok: true, value: Math.round(n) };
}

function clampText(val, maxLen) {
  if (typeof val !== "string") return "";
  const cleaned = val.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function sanitizeCheckItem(item, defaultMax) {
  if (!item || typeof item !== "object") return null;
  const rawScore = Number(item.score);
  const rawMax = Number(item.max_score ?? defaultMax);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(defaultMax, Math.round(rawScore))) : 0;
  const maxScore = Number.isFinite(rawMax) && rawMax > 0 && rawMax <= 100 ? Math.round(rawMax) : defaultMax;
  const light = item.light === "green" || item.light === "yellow" || item.light === "red" ? item.light : "red";
  return {
    score,
    max_score: maxScore,
    light,
    summary: clampText(item.summary, 360),
  };
}

function sanitizeReportSummary(rawReport, fallbackScore, targetUrlHref) {
  if (rawReport !== undefined && rawReport !== null && (typeof rawReport !== "object" || Array.isArray(rawReport))) {
    return { ok: false, code: "INVALID_SUMMARY", error: "報告摘要格式不正確。" };
  }

  const src = rawReport || {};
  const scoreCheck = parseOptionalScore(src.score ?? fallbackScore, "總分");
  if (!scoreCheck.ok) return scoreCheck;

  const light =
    src.grade_light === "green" || src.grade_light === "yellow" || src.grade_light === "red"
      ? src.grade_light
      : scoreCheck.value !== null && scoreCheck.value >= 80
        ? "green"
        : scoreCheck.value !== null && scoreCheck.value >= 50
          ? "yellow"
          : "red";

  const checksSrc = src.checks && typeof src.checks === "object" ? src.checks : {};
  const checks = {
    robots: sanitizeCheckItem(checksSrc.robots, 35),
    llms: sanitizeCheckItem(checksSrc.llms, 30),
    homepage: sanitizeCheckItem(checksSrc.homepage, 35),
  };

  let recommendations = [];
  if (Array.isArray(src.recommendations)) {
    recommendations = src.recommendations
      .slice(0, 8)
      .map((r) => clampText(r, 320))
      .filter(Boolean);
  }

  const conversionDiagnosis = sanitizeConversionDiagnosis(src.conversion_diagnosis);
  const weeklyPrescription = sanitizeWeeklyPrescription(src.weekly_wuxing_prescription);

  return {
    ok: true,
    summary: {
      target_url: targetUrlHref,
      score: scoreCheck.value,
      grade_light: light,
      grade_label: clampText(src.grade_label, 140),
      checks,
      recommendations,
      conversion_diagnosis: conversionDiagnosis,
      weekly_wuxing_prescription: weeklyPrescription,
    },
  };
}

function getDisplayHost(urlHref) {
  try {
    return new URL(urlHref).hostname;
  } catch {
    return String(urlHref || "");
  }
}

function formatDiffVerdict(myScore, compScore) {
  if (myScore === null || compScore === null) return null;
  const diff = myScore - compScore;
  if (diff > 0) {
    return { diff, text: `領先對手 +${diff} 分`, tone: "#34b399" };
  }
  if (diff < 0) {
    return { diff, text: `落後對手 ${Math.abs(diff)} 分`, tone: "#e26d5a" };
  }
  return { diff: 0, text: "與對手平手（0 分差）", tone: "#d9a74a" };
}

function buildVisitorEmail({ targetSummary, competitorSummary, submittedAt }) {
  const myHost = getDisplayHost(targetSummary.target_url);
  const myScoreText = targetSummary.score !== null ? `${targetSummary.score}` : "—";
  const isPk = Boolean(competitorSummary);
  const compHost = isPk ? getDisplayHost(competitorSummary.target_url) : "";
  const compScoreText = isPk && competitorSummary.score !== null ? `${competitorSummary.score}` : "—";
  const verdict = isPk ? formatDiffVerdict(targetSummary.score, competitorSummary.score) : null;

  const subject = stripHeaderBreaks(
    isPk
      ? `【阿男 GEO 實戰工坊】GEO 基礎初檢與對手差距報告（${myHost} ${myScoreText} 分 vs ${compHost} ${compScoreText} 分）`
      : `【阿男 GEO 實戰工坊】GEO 基礎初檢與對手差距報告（${myHost}：${myScoreText} / 100 分）`
  );

  const checkDefs = [
    { key: "robots", label: "01｜AI 爬蟲放行（robots.txt）", max: 35 },
    { key: "llms", label: "02｜AI 導覽索引（llms.txt）", max: 30 },
    { key: "homepage", label: "03｜官網結構與標籤（首頁 HTML / JSON-LD）", max: 35 },
  ];

  const detailRowsHtml = checkDefs
    .map((def) => {
      const mine = targetSummary.checks[def.key];
      const comp = isPk ? competitorSummary.checks[def.key] : null;
      const myCell = mine
        ? `<strong>${mine.score} / ${mine.max_score}</strong>（${escapeHtml(LIGHT_LABELS[mine.light] || mine.light)}）<br><span style="color:#475569;font-size:13px;">${escapeHtml(mine.summary || "已完成基礎實測")}</span>`
        : "—";
      const compCell = isPk
        ? comp
          ? `<strong>${comp.score} / ${comp.max_score}</strong>（${escapeHtml(LIGHT_LABELS[comp.light] || comp.light)}）<br><span style="color:#475569;font-size:13px;">${escapeHtml(comp.summary || "已完成基礎實測")}</span>`
          : "—"
        : "";
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;vertical-align:top;">${escapeHtml(def.label)}</td>
          <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:top;">${myCell}</td>
          ${isPk ? `<td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:top;">${compCell}</td>` : ""}
        </tr>`;
    })
    .join("");

  const recsHtml =
    targetSummary.recommendations.length > 0
      ? targetSummary.recommendations
          .map((rec) => `<li style="margin:0 0 8px;line-height:1.65;">${escapeHtml(rec)}</li>`)
          .join("")
      : `<li style="margin:0;line-height:1.65;">基礎公開設定皆已到位，建議進一步透過 20 題跨平台無痕實測確認 AI 實際點名與報價準確度。</li>`;

  const lightPillStyle = (light) => {
    if (light === "green") return "background:#d1fae5;color:#065f46;";
    if (light === "yellow") return "background:#fef3c7;color:#92400e;";
    return "background:#fee2e2;color:#991b1b;";
  };

  const convDiag = targetSummary.conversion_diagnosis;
  const convHtml =
    convDiag && Array.isArray(convDiag.indicators) && convDiag.indicators.length > 0
      ? `
      <h2 style="margin:24px 0 10px;font-size:16px;color:#0f172a;">網站成交力 4 大指標診斷</h2>
      <p style="margin:0 0 10px;font-size:13.5px;color:#475569;line-height:1.6;">${escapeHtml(convDiag.summary || "針對手機好讀度、痛點問答、真實見證與破冰體驗入口的即時掃描結果：")}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;border:1px solid #e2e8f0;margin-bottom:18px;">
        <tbody>
          ${convDiag.indicators
            .map(
              (ind) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;width:36%;vertical-align:top;">
              ${escapeHtml(ind.name)}<br>
              <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;${lightPillStyle(ind.light)}">${escapeHtml(ind.light_label || LIGHT_LABELS[ind.light] || ind.light)}</span>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;vertical-align:top;line-height:1.6;">
              ${escapeHtml(ind.summary)}<br>
              <span style="color:#0f766e;font-size:12.5px;">建議：${escapeHtml(ind.recommendation)}</span>
            </td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  const rx = targetSummary.weekly_wuxing_prescription;
  const rxHtml =
    rx && Array.isArray(rx.posts) && rx.posts.length > 0
      ? `
      <h2 style="margin:24px 0 8px;font-size:16px;color:#0f172a;">贈送：下週 5 篇五行發文處方箋（連標題都幫你擬好了）</h2>
      <p style="margin:0 0 12px;font-size:13.5px;color:#475569;line-height:1.6;">${escapeHtml(rx.intro || "週一至週五涵蓋金木水火土完整一輪，直接照著發就能幫官網與社群累積信任。")}</p>
      ${rx.posts
        .map(
          (post) => `
      <div style="margin:0 0 10px;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;">
        <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;">${escapeHtml(post.day)}｜${escapeHtml(post.element_label)}${post.priority_note ? `・${escapeHtml(post.priority_note)}` : ""}</div>
        <div style="font-size:14.5px;font-weight:700;color:#0f172a;margin-bottom:6px;line-height:1.5;">${escapeHtml(post.title)}</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.6;">
          ${(Array.isArray(post.writing_tips) ? post.writing_tips : [])
            .map((tip) => `<li style="margin:0 0 3px;">${escapeHtml(tip)}</li>`)
            .join("")}
        </ul>
      </div>`
        )
        .join("")}`
      : "";

  const pkBannerHtml = isPk
    ? `
      <div style="margin:16px 0;padding:16px;border-radius:10px;background:#0f172a;color:#f8fafc;">
        <div style="font-size:12px;letter-spacing:0.06em;color:#d9a74a;margin-bottom:6px;">同行對手 PK 勝負總覽</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:6px;">
          我方 ${escapeHtml(myHost)}：${escapeHtml(myScoreText)} 分　vs　對手 ${escapeHtml(compHost)}：${escapeHtml(compScoreText)} 分
        </div>
        ${verdict ? `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${verdict.tone};color:#0b1117;font-weight:700;font-size:13px;">${escapeHtml(verdict.text)}</div>` : ""}
      </div>`
    : `
      <div style="margin:16px 0;padding:16px;border-radius:10px;background:#0f172a;color:#f8fafc;">
        <div style="font-size:12px;letter-spacing:0.06em;color:#d9a74a;margin-bottom:6px;">GEO 基礎準備度總分</div>
        <div style="font-size:22px;font-weight:700;">${escapeHtml(myScoreText)} / 100 分（${escapeHtml(LIGHT_LABELS[targetSummary.grade_light] || "")}）</div>
        <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">檢測網址：${escapeHtml(targetSummary.target_url)}</div>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;color:#0f172a;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #cbd5e1;overflow:hidden;">
    <div style="padding:22px 26px;background:#0b1117;color:#ecf1f6;border-bottom:3px solid #d9a74a;">
      <div style="font-size:12px;letter-spacing:0.08em;color:#d9a74a;">阿男 GEO 實戰工坊・基礎公開頁初檢報告</div>
      <h1 style="margin:6px 0 0;font-size:20px;line-height:1.4;">${isPk ? "您的網站 vs 同行對手 GEO 基礎 PK 報告" : "您的網站 GEO 基礎初檢報告"}</h1>
    </div>

    <div style="padding:24px 26px;">
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">您好！以下是您在 <strong>anangeo.com</strong> 剛完成的公開頁即時基礎初檢摘要（檢測時間：${escapeHtml(submittedAt)}）：</p>

      ${pkBannerHtml}

      <h2 style="margin:22px 0 10px;font-size:16px;color:#0f172a;">三項基礎紅綠燈明細</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #cbd5e1;">檢查項目</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #cbd5e1;">我方網站（${escapeHtml(myHost)}）</th>
            ${isPk ? `<th style="padding:10px 12px;text-align:left;border-bottom:1px solid #cbd5e1;">對手網站（${escapeHtml(compHost)}）</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${detailRowsHtml}
        </tbody>
      </table>

      <h2 style="margin:22px 0 10px;font-size:16px;color:#0f172a;">白話優先修復建議</h2>
      <ul style="margin:0 0 18px;padding-left:20px;font-size:14px;color:#334155;">
        ${recsHtml}
      </ul>

      ${convHtml}
      ${rxHtml}

      <div style="padding:16px 18px;border-radius:10px;background:#fffbeb;border:1px solid #f59e0b;">
        <div style="font-weight:700;font-size:15px;color:#92400e;margin-bottom:6px;">下一步：想知道 ChatGPT、Gemini、Perplexity 真實回答有沒有點名你？</div>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#78350f;">
          基礎初檢看的是「網站設定檔有沒有寫好」；若想實測 20 題跨平台無痕原答、追查 AI 有沒有報錯舊價格並取得 9 維度健檢報告，歡迎直接加官方 LINE <strong>${LINE_ID}</strong> 傳送您的網址預約。
        </p>
        <a href="${LINE_URL}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0b1117;color:#f8fafc;text-decoration:none;font-weight:700;font-size:14px;">加入官方 LINE ${LINE_ID} 預約深度健檢</a>
      </div>

      <p style="margin:20px 0 8px;font-size:12px;color:#64748b;line-height:1.6;">
        免責聲明：本工具僅為基礎公開頁初檢（即時檢查 robots.txt、llms.txt 與首頁 HTML／JSON-LD），不含 20 題跨平台 AI 實測與 WAF 深度掃描；本工坊不保證 AI 排名或必被推薦。本工坊專注品牌 GEO 服務，與 cccnan.art 客製紀念歌曲業務分開營運。
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
        取消訂閱／退訂說明：您因在 anangeo.com 勾選同意接收報告與 GEO 實戰資訊而收到此信。如不願再收到後續通知，請直接回覆此信註明「取消訂閱」，或於官方 LINE ${LINE_ID} 告知，我們將立即停止寄送並自推廣名單移除。
      </p>
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    "【阿男 GEO 實戰工坊｜基礎公開頁初檢報告】",
    `檢測時間：${submittedAt}`,
    `我方網址：${targetSummary.target_url}（${myScoreText} / 100 分）`,
  ];
  if (isPk) {
    textLines.push(`對手網址：${competitorSummary.target_url}（${compScoreText} / 100 分）`);
    if (verdict) textLines.push(`PK 勝負差距：${verdict.text}`);
  }
  textLines.push("", "【白話優先修復建議】");
  if (targetSummary.recommendations.length > 0) {
    targetSummary.recommendations.forEach((r, idx) => textLines.push(`${idx + 1}. ${r}`));
  } else {
    textLines.push("1. 公開首頁基礎設定已到位，建議進一步做 20 題跨平台無痕實測。");
  }
  const convRxPlain = formatPrescriptionPlainText(
    targetSummary.conversion_diagnosis,
    targetSummary.weekly_wuxing_prescription
  );
  if (convRxPlain) {
    textLines.push("", convRxPlain);
  }
  textLines.push(
    "",
    `下一步預約完整 20 題與 9 維度健檢：加入官方 LINE ${LINE_ID}（${LINE_URL}）`,
    `退訂說明：若不願再收到後續實戰資訊，請直接回覆此信或於 LINE ${LINE_ID} 告知「取消訂閱」，我們將立即移除。`
  );

  return { subject, html, text: textLines.join("\n") };
}

function buildDay3CaseStudyEmail({ targetSummary, competitorSummary }) {
  const myHost = getDisplayHost(targetSummary.target_url);
  const myScoreText = targetSummary.score !== null ? `${targetSummary.score}` : "—";
  const isPk = Boolean(competitorSummary);
  const compHost = isPk ? getDisplayHost(competitorSummary.target_url) : "";

  const subject = stripHeaderBreaks(
    "【阿男 GEO 實戰工坊】真實破案實錄：為什麼網站有做傳統 SEO，ChatGPT 與 Gemini 還是推薦對手或報錯價格？"
  );

  const contextNote = isPk
    ? `3 天前您在 anangeo.com 剛為 <strong>${escapeHtml(myHost)}</strong>（${escapeHtml(myScoreText)} / 100 分）與 <strong>${escapeHtml(compHost)}</strong> 做過基礎 PK 初檢。`
    : `3 天前您在 anangeo.com 剛為 <strong>${escapeHtml(myHost)}</strong>（基礎分數 ${escapeHtml(myScoreText)} / 100 分）做過公開頁初檢。`;

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;color:#0f172a;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #cbd5e1;overflow:hidden;">
    <div style="padding:22px 26px;background:#0b1117;color:#ecf1f6;border-bottom:3px solid #d9a74a;">
      <div style="font-size:12px;letter-spacing:0.08em;color:#d9a74a;">阿男 GEO 實戰工坊・第 3 天實戰破案筆記</div>
      <h1 style="margin:6px 0 0;font-size:20px;line-height:1.45;">真實破案實錄：為什麼網站有做傳統 SEO，ChatGPT 與 Gemini 還是推薦對手或報錯價格？</h1>
    </div>

    <div style="padding:24px 26px;font-size:15px;line-height:1.72;color:#1e293b;">
      <p style="margin:0 0 14px;">您好！${contextNote}</p>
      <p style="margin:0 0 16px;">
        許多品牌主最困惑的是：「明明我們官網都有做傳統 SEO、Google 排名也不差，為什麼客戶去問 ChatGPT、Gemini 或 Perplexity 時，AI 卻直接推薦對手，甚至把兩年前的舊價格背出來？」
      </p>

      <div style="margin:18px 0;padding:18px;border-radius:10px;background:#0f172a;color:#f8fafc;">
        <div style="font-size:12px;letter-spacing:0.06em;color:#d9a74a;margin-bottom:8px;">1,298 筆跨引擎無痕實測・抓出的 3 個結構盲點</div>
        <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.75;color:#e2e8f0;">
          <li style="margin-bottom:8px;"><strong>不同 AI 吃的信源完全不同（同條件巨大分化）</strong>：在我們針對單一品牌累積 1,298 筆無痕實測中，同一時間 Perplexity 露出率達 51.9%、ChatGPT 達 33.3%，但 Gemini 卻曾是 0%——只看單一搜尋排名會完全忽略跨引擎落差。</li>
          <li style="margin-bottom:8px;"><strong>爬蟲門沒開齊、導覽索引變軟 404</strong>：不少網站只顧 Googlebot，卻在 robots.txt 或 CDN 防火牆誤擋 <code>OAI-SearchBot</code>／<code>PerplexityBot</code>，或是 <code>/llms.txt</code> 其實回傳了首頁 HTML，讓 AI 根本抓不到你的服務規格。</li>
          <li><strong>舊網頁快照與跨平台口徑沒對齊，害 AI 報錯舊價</strong>：官網改版後沒有把舊測試網域做 308 轉址，或外部媒體／粉專殘留舊價格，AI 就會把過期規則寫進推薦答案，讓潛在客戶直接流失給對手。</li>
        </ol>
      </div>

      <p style="margin:0 0 16px;">
        我們把這套從「AI 報錯舊價」一路追查到「跨引擎穩定引用官網與正確聯絡入口」的完整過程，整理成 4 篇白話教學與可核對的 1,298 筆實測儀表板，直接公開在網站上供您參考：
      </p>

      <div style="margin:18px 0;padding:16px 18px;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;">
        <a href="${SITE_URL}/#guides" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0b1117;color:#f8fafc;text-decoration:none;font-weight:700;font-size:14px;margin-right:8px;margin-bottom:8px;">閱讀 4 篇白話破案實錄</a>
        <a href="${LINE_URL}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#d9a74a;color:#0b1117;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:8px;">加官方 LINE ${LINE_ID} 詢問網站盲點</a>
      </div>

      <p style="margin:18px 0 8px;font-size:12px;color:#64748b;line-height:1.6;">
        免責聲明：AI 引擎回答具隨機性，本工坊不保證 AI 排名或必被推薦，僅提供可核對之無痕實測證據與網站結構化改造。本工坊與 cccnan.art 客製紀念歌曲業務分開營運。
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
        聯絡與退訂說明：官方網站 <a href="${SITE_URL}" style="color:#475569;">anangeo.com</a>｜官方 LINE <strong>${LINE_ID}</strong>（${LINE_URL}）。您因於 anangeo.com 勾選同意接收報告與 GEO 實戰資訊而收到此信；如不願再收到後續信件，請直接回覆此信註明「取消訂閱」，或於官方 LINE ${LINE_ID} 告知，我們將立即自名單移除。
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    "【阿男 GEO 實戰工坊｜第 3 天實戰破案筆記】",
    "真實破案實錄：為什麼網站有做傳統 SEO，ChatGPT 與 Gemini 還是推薦對手或報錯價格？",
    "",
    `您好！3 天前您在 anangeo.com 剛檢測過 ${targetSummary.target_url}（基礎分數 ${myScoreText} / 100 分）。`,
    "我們整理了 1,298 筆跨引擎無痕實測中，最常害品牌被 AI 忽略或報錯價的 3 個結構盲點：",
    "1. 不同 AI 吃的信源不同：同條件未登入曾出現 Perplexity 51.9%、ChatGPT 33.3% vs Gemini 0% 的巨大分化。",
    "2. 爬蟲門沒開齊或 llms.txt 變軟 404：robots.txt／CDN 誤擋 AI 搜尋爬蟲，或首頁缺少對齊的 JSON-LD Schema。",
    "3. 舊網頁快照與跨平台口徑沒統一：殘留舊測試域或過期方案文字，導致 AI 把舊價格原封不動講給客戶聽。",
    "",
    `看完整 4 篇白話破案實錄：${SITE_URL}/#guides`,
    `直接詢問您的網站結構盲點：加入官方 LINE ${LINE_ID}（${LINE_URL}）`,
    "",
    `聯絡與退訂說明：官方網站 ${SITE_URL}｜官方 LINE ${LINE_ID}。如不願再收到後續實戰信件，請直接回覆此信或於 LINE ${LINE_ID} 告知「取消訂閱」，我們將立即移除。`,
  ].join("\n");

  return { subject, html, text };
}

function buildDay7CreditReminderEmail({ targetSummary, competitorSummary }) {
  const myHost = getDisplayHost(targetSummary.target_url);
  const myScoreText = targetSummary.score !== null ? `${targetSummary.score}` : "—";
  const isPk = Boolean(competitorSummary);
  const compHost = isPk ? getDisplayHost(competitorSummary.target_url) : "";

  const subject = stripHeaderBreaks(
    "【阿男 GEO 實戰工坊】專屬健檢折抵提醒：NT$3,800 深度 20 題健檢 30 天內可 100% 折抵改造費"
  );

  const pkReminder = isPk
    ? `（當時您也同步比對了對手 <strong>${escapeHtml(compHost)}</strong>）`
    : "";

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;color:#0f172a;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #cbd5e1;overflow:hidden;">
    <div style="padding:22px 26px;background:#0b1117;color:#ecf1f6;border-bottom:3px solid #d9a74a;">
      <div style="font-size:12px;letter-spacing:0.08em;color:#d9a74a;">阿男 GEO 實戰工坊・第 7 天專屬健檢折抵提醒</div>
      <h1 style="margin:6px 0 0;font-size:20px;line-height:1.45;">專屬健檢折抵提醒：NT$3,800 深度 20 題健檢 30 天內可 100% 折抵改造費</h1>
    </div>

    <div style="padding:24px 26px;font-size:15px;line-height:1.72;color:#1e293b;">
      <p style="margin:0 0 14px;">
        您好！距離您在 anangeo.com 檢測 <strong>${escapeHtml(myHost)}</strong>（基礎準備度 ${escapeHtml(myScoreText)} / 100 分）${pkReminder}已經過了一週。
      </p>
      <p style="margin:0 0 16px;">
        免費 10 秒初檢能幫您確認 <code>robots.txt</code>、<code>llms.txt</code> 與首頁標籤等基礎設定，但真正會影響客戶詢價的，是 <strong>ChatGPT、Gemini、Perplexity 在無痕新對話裡實際怎麼介紹您與對手</strong>。
      </p>

      <div style="margin:18px 0;padding:18px;border-radius:10px;background:#fffbeb;border:1px solid #f59e0b;">
        <div style="font-weight:700;font-size:16px;color:#92400e;margin-bottom:8px;">入門級《基礎 GEO 健檢與 20 題 AI 診斷報告》— NT$3,800</div>
        <ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.7;color:#78350f;">
          <li><strong>20 題跨平台無痕實測原答證據</strong>：每題開新對話、不餵答案，真實抓出 AI 有沒有點名您、有沒有推薦對手或報錯舊價格。</li>
          <li><strong>9 維度站點深度體檢＋修復清單</strong>：從爬蟲、Schema 到跨平台信源一次盤點優先順序。</li>
          <li><strong>30 天內 100% 折抵改造費</strong>：若健檢後 30 天內決定升級小型官網 GEO 地基一次改造（NT$18,000），這筆 NT$3,800 健檢費可直接 <strong>100% 全額折抵</strong>。</li>
        </ul>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#78350f;">
          還不確定您這個產業應該問 AI 哪 20 題嗎？歡迎先直接加官方 LINE <strong>${LINE_ID}</strong> 傳送您的網址，我們可以先<strong>免費幫您挑選 5 題最貼近您產業的真實測試題</strong>一起確認方向，確認有幫助再決定！
        </p>
        <a href="${LINE_URL}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#0b1117;color:#f8fafc;text-decoration:none;font-weight:700;font-size:14px;">加入官方 LINE ${LINE_ID}・免費先挑 5 題產業測試題</a>
      </div>

      <p style="margin:18px 0 8px;font-size:12px;color:#64748b;line-height:1.6;">
        免責聲明：本工坊不保證 AI 排名、必被推薦或保證成交；所有方案透明公開於 <a href="${SITE_URL}/#pricing" style="color:#475569;">anangeo.com/#pricing</a>。本工坊專注品牌 GEO 服務，與 cccnan.art 客製紀念歌曲業務分開營運。
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
        聯絡與退訂說明：官方網站 <a href="${SITE_URL}" style="color:#475569;">anangeo.com</a>｜官方 LINE <strong>${LINE_ID}</strong>（${LINE_URL}）。此信為您於 anangeo.com 勾選同意後自動排程之第 3 封（也是最後一封）追蹤提醒；如需自名單移除，請直接回覆此信或於 LINE ${LINE_ID} 告知「取消訂閱」。
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    "【阿男 GEO 實戰工坊｜第 7 天專屬健檢折抵提醒】",
    "專屬健檢折抵提醒：NT$3,800 深度 20 題健檢 30 天內可 100% 折抵改造費",
    "",
    `您好！距離您在 anangeo.com 檢測 ${targetSummary.target_url}（基礎分數 ${myScoreText} / 100 分）已經一週。`,
    "",
    "入門級《基礎 GEO 健檢與 20 題 AI 診斷報告》（NT$3,800）包含：",
    "- 20 題跨平台無痕實測原答證據（不餵答案，查明 AI 是否推薦對手或報錯舊價格）",
    "- 9 維度站點深度體檢與優先修復清單",
    "- 30 天內升級小型官網 GEO 地基一次改造（NT$18,000），NT$3,800 可 100% 折抵改造費",
    "",
    `歡迎直接加入官方 LINE ${LINE_ID}（${LINE_URL}），傳送您的網址即可免費先挑 5 題產業測試題一起討論。`,
    "",
    `方案詳情：${SITE_URL}/#pricing`,
    `聯絡與退訂說明：官方網站 ${SITE_URL}｜官方 LINE ${LINE_ID}。此為自動排程之最後一封提醒；如需停止聯繫並自名單移除，請直接回覆此信或於 LINE ${LINE_ID} 告知「取消訂閱」。`,
  ].join("\n");

  return { subject, html, text };
}

function buildAdminNotifyEmail({ email, targetSummary, competitorSummary, submittedAt, day3At, day7At }) {
  const isPk = Boolean(competitorSummary);
  const verdict = isPk ? formatDiffVerdict(targetSummary.score, competitorSummary.score) : null;
  const myScoreText = targetSummary.score !== null ? `${targetSummary.score} / 100` : "—";
  const compScoreText = isPk && competitorSummary.score !== null ? `${competitorSummary.score} / 100` : "未填寫";

  const subject = stripHeaderBreaks(
    `【anangeo.com 新名單通知】${email}（${getDisplayHost(targetSummary.target_url)}：${myScoreText}）`
  );

  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="utf-8"></head>
<body style="font-family:'PingFang TC','Noto Sans TC',sans-serif;color:#0f172a;padding:16px;">
  <h2 style="margin:0 0 12px;">anangeo.com 收到新 GEO 初檢解鎖名單</h2>
  <table style="border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 12px;font-weight:700;">訪客 Email</td><td style="padding:6px 12px;">${escapeHtml(email)}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">測驗網址</td><td style="padding:6px 12px;">${escapeHtml(targetSummary.target_url)}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">我方分數</td><td style="padding:6px 12px;">${escapeHtml(myScoreText)}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">對手網址</td><td style="padding:6px 12px;">${isPk ? escapeHtml(competitorSummary.target_url) : "未填寫"}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">對手分數</td><td style="padding:6px 12px;">${escapeHtml(compScoreText)}${verdict ? `（我方${escapeHtml(verdict.text)}）` : ""}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">個資同意</td><td style="padding:6px 12px;">已明確勾選同意（consent: true）</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">追單三部曲</td><td style="padding:6px 12px;">即時信＋第 3 天（${escapeHtml(day3At || "")}）＋第 7 天（${escapeHtml(day7At || "")}）</td></tr>
    <tr><td style="padding:6px 12px;font-weight:700;">送出時間</td><td style="padding:6px 12px;">${escapeHtml(submittedAt)}</td></tr>
  </table>
</body>
</html>`;

  const text = [
    "anangeo.com 新名單通知",
    `訪客 Email：${email}`,
    `測驗網址：${targetSummary.target_url}`,
    `我方分數：${myScoreText}`,
    `對手網址：${isPk ? competitorSummary.target_url : "未填寫"}`,
    `對手分數：${compScoreText}${verdict ? `（我方${verdict.text}）` : ""}`,
    `追單排程：第 3 天 ${day3At || ""}｜第 7 天 ${day7At || ""}`,
    `送出時間：${submittedAt}`,
  ].join("\n");

  return { subject, html, text };
}

async function callResend(fetchFn, apiKey, url, body) {
  try {
    const resp = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    return { ok: resp.ok, status: resp.status };
  } catch {
    return { ok: false, status: null };
  }
}

const CREATE_LEADS_TABLE_SQL = `
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

async function persistLeadToD1(env, record) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return { saved: false, id: null };
  }
  try {
    await env.DB.prepare(CREATE_LEADS_TABLE_SQL).run();
    const insertRes = await env.DB.prepare(
      `INSERT INTO leads (email, target_url, competitor_url, score, competitor_score, grade_light, summary_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        record.email,
        record.target_url,
        record.competitor_url,
        record.score,
        record.competitor_score,
        record.grade_light,
        record.summary_json,
        record.created_at
      )
      .run();
    return {
      saved: true,
      id: insertRes?.meta?.last_row_id ?? null,
    };
  } catch {
    return { saved: false, id: null };
  }
}

export async function onRequest(context) {
  const { request, env = {} } = context || {};

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        code: "METHOD_NOT_ALLOWED",
        error: "此端點僅支援 POST 與 OPTIONS 請求。",
      },
      405
    );
  }

  const parsedBody = await readJsonBodyLimited(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    return jsonResponse(
      {
        ok: false,
        code: parsedBody.code,
        error: parsedBody.error,
      },
      parsedBody.status
    );
  }

  const body = parsedBody.data;

  // 1. 驗證個資同意（必須嚴格為布林 true）
  if (body.consent !== true) {
    return jsonResponse(
      {
        ok: false,
        code: "CONSENT_REQUIRED",
        error: "請先勾選同意條款，才能解鎖並寄送檢測報告。",
      },
      400
    );
  }

  // 2. 驗證 Email 格式
  const emailCheck = validateEmail(body.email);
  if (!emailCheck.ok) {
    return jsonResponse(
      {
        ok: false,
        code: emailCheck.code,
        error: emailCheck.error,
      },
      400
    );
  }

  // 3. 驗證主測公開網址
  const targetCheck = validatePublicUrl(body.target_url);
  if (!targetCheck.ok) {
    return jsonResponse(
      {
        ok: false,
        code: targetCheck.code,
        error: targetCheck.error,
      },
      400
    );
  }

  // 4. 驗證選填對手公開網址
  let compUrlHref = null;
  if (body.competitor_url !== undefined && body.competitor_url !== null && String(body.competitor_url).trim() !== "") {
    const compCheck = validatePublicUrl(String(body.competitor_url));
    if (!compCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          code: compCheck.code,
          error: `對手網址驗證失敗：${compCheck.error}`,
        },
        400
      );
    }
    compUrlHref = compCheck.url.href;
  }

  // 5. 驗證與清理分數摘要資料
  const topScoreCheck = parseOptionalScore(body.score, "主測總分");
  if (!topScoreCheck.ok) {
    return jsonResponse({ ok: false, code: topScoreCheck.code, error: topScoreCheck.error }, 400);
  }
  const topCompScoreCheck = parseOptionalScore(body.competitor_score, "對手總分");
  if (!topCompScoreCheck.ok) {
    return jsonResponse({ ok: false, code: topCompScoreCheck.code, error: topCompScoreCheck.error }, 400);
  }

  const targetReportCheck = sanitizeReportSummary(body.report, topScoreCheck.value, targetCheck.url.href);
  if (!targetReportCheck.ok) {
    return jsonResponse({ ok: false, code: targetReportCheck.code, error: targetReportCheck.error }, 400);
  }

  let competitorSummary = null;
  if (compUrlHref) {
    const compReportCheck = sanitizeReportSummary(
      body.competitor_report,
      topCompScoreCheck.value,
      compUrlHref
    );
    if (!compReportCheck.ok) {
      return jsonResponse({ ok: false, code: compReportCheck.code, error: compReportCheck.error }, 400);
    }
    competitorSummary = compReportCheck.summary;
  }

  const nowMs =
    typeof context?.now === "number" && Number.isFinite(context.now) ? context.now : Date.now();
  const submittedAt = new Date(nowMs).toISOString();

  // 5.5 若已綁定 Cloudflare D1（env.DB），同步寫入雲端 leads 表（容錯不影響前端解鎖）
  const d1Result = await persistLeadToD1(env, {
    email: emailCheck.email,
    target_url: targetReportCheck.summary.target_url,
    competitor_url: competitorSummary ? competitorSummary.target_url : null,
    score: targetReportCheck.summary.score,
    competitor_score: competitorSummary ? competitorSummary.score : null,
    grade_light: targetReportCheck.summary.grade_light,
    summary_json: JSON.stringify({
      target: targetReportCheck.summary,
      competitor: competitorSummary,
    }),
    created_at: submittedAt,
  });

  // 6. 尚未設定 RESEND_API_KEY -> 優雅降級回傳 200 preview_unlock（絕不回 500）
  const apiKey = typeof env?.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!apiKey) {
    return jsonResponse(
      {
        ok: true,
        unlocked: true,
        mail_sent: false,
        lead_stored: d1Result.saved,
        followup_scheduled: {
          day3: false,
          day7: false,
          day3_at: null,
          day7_at: null,
        },
        mode: "preview_unlock",
        message: "完整報告已為您免費解鎖！歡迎加官方 LINE @250ruauk 預約 20 題深度健檢。",
      },
      200
    );
  }

  // 7. 已設定 RESEND_API_KEY -> 平行寄送：第 0 天即時信 + 第 3 天(+72h)排程信 + 第 7 天(+168h)排程信 + Audience + 管理員通知
  const fetchFn = typeof context?.fetch === "function" ? context.fetch : globalThis.fetch;
  const fromAddress =
    typeof env?.RESEND_FROM === "string" && env.RESEND_FROM.trim()
      ? stripHeaderBreaks(env.RESEND_FROM)
      : DEFAULT_FROM;
  const audienceId = typeof env?.RESEND_AUDIENCE_ID === "string" ? env.RESEND_AUDIENCE_ID.trim() : "";
  const adminEmailRaw = typeof env?.ADMIN_NOTIFY_EMAIL === "string" ? env.ADMIN_NOTIFY_EMAIL.trim() : "";
  const adminEmailCheck = adminEmailRaw ? validateEmail(adminEmailRaw) : { ok: false };

  const day3At = new Date(nowMs + FOLLOWUP_DELAY_HOURS.day3 * 60 * 60 * 1000).toISOString();
  const day7At = new Date(nowMs + FOLLOWUP_DELAY_HOURS.day7 * 60 * 60 * 1000).toISOString();

  const visitorEmailContent = buildVisitorEmail({
    targetSummary: targetReportCheck.summary,
    competitorSummary,
    submittedAt,
  });

  const day3EmailContent = buildDay3CaseStudyEmail({
    targetSummary: targetReportCheck.summary,
    competitorSummary,
  });

  const day7EmailContent = buildDay7CreditReminderEmail({
    targetSummary: targetReportCheck.summary,
    competitorSummary,
  });

  // 第 1 封（當下立即寄出）
  const visitorPromise = callResend(fetchFn, apiKey, "https://api.resend.com/emails", {
    from: fromAddress,
    to: [emailCheck.email],
    subject: visitorEmailContent.subject,
    html: visitorEmailContent.html,
    text: visitorEmailContent.text,
  });

  // 第 2 封（+72 小時／第 3 天排程信，獨立容錯不影響即時信）
  const day3Promise = callResend(fetchFn, apiKey, "https://api.resend.com/emails", {
    from: fromAddress,
    to: [emailCheck.email],
    subject: day3EmailContent.subject,
    html: day3EmailContent.html,
    text: day3EmailContent.text,
    scheduled_at: day3At,
  });

  // 第 3 封（+168 小時／第 7 天排程信，獨立容錯不影響即時信）
  const day7Promise = callResend(fetchFn, apiKey, "https://api.resend.com/emails", {
    from: fromAddress,
    to: [emailCheck.email],
    subject: day7EmailContent.subject,
    html: day7EmailContent.html,
    text: day7EmailContent.text,
    scheduled_at: day7At,
  });

  const audiencePromise = audienceId
    ? callResend(
        fetchFn,
        apiKey,
        `https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`,
        {
          email: emailCheck.email,
          unsubscribed: false,
        }
      )
    : Promise.resolve({ ok: false, skipped: true });

  const adminPromise = adminEmailCheck.ok
    ? (() => {
        const adminEmailContent = buildAdminNotifyEmail({
          email: emailCheck.email,
          targetSummary: targetReportCheck.summary,
          competitorSummary,
          submittedAt,
          day3At,
          day7At,
        });
        return callResend(fetchFn, apiKey, "https://api.resend.com/emails", {
          from: fromAddress,
          to: [adminEmailCheck.email],
          subject: adminEmailContent.subject,
          html: adminEmailContent.html,
          text: adminEmailContent.text,
        });
      })()
    : Promise.resolve({ ok: false, skipped: true });

  const [visitorRes, day3Res, day7Res, audienceRes, adminRes] = await Promise.all([
    visitorPromise,
    day3Promise,
    day7Promise,
    audiencePromise,
    adminPromise,
  ]);

  const mailSent = Boolean(visitorRes?.ok);
  const day3Scheduled = Boolean(day3Res?.ok);
  const day7Scheduled = Boolean(day7Res?.ok);

  return jsonResponse(
    {
      ok: true,
      unlocked: true,
      mail_sent: mailSent,
      lead_stored: d1Result.saved,
      followup_scheduled: {
        day3: day3Scheduled,
        day7: day7Scheduled,
        day3_at: day3Scheduled ? day3At : null,
        day7_at: day7Scheduled ? day7At : null,
      },
      contact_saved: Boolean(audienceRes?.ok),
      admin_notified: Boolean(adminRes?.ok),
      mode: mailSent ? "resend_live" : "resend_fallback",
      message: mailSent
        ? "完整報告已解鎖並同步寄送至您的信箱！歡迎加官方 LINE @250ruauk 預約深度健檢。"
        : "完整報告已為您免費解鎖！（信件寄送暫時忙碌，您可直接檢視或複製完整明細並加 LINE @250ruauk）。",
    },
    200
  );
}
