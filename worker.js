import { onRequest as handleApiCheck } from "./functions/api/check.js";
import { onRequest as handleApiLead } from "./functions/api/lead.js";
import {
  onRequest as handleApiAdmin,
  isAdminAuthorized,
  verifySessionRequest,
} from "./functions/api/admin.js";

const DEFAULT_RELAY_PROMOTIONS_URL = "https://relay.anangeo.com/api/promotions?tenant=geo-26d78867";
const DEFAULT_RELAY_TENANT_SLUG = "geo-26d78867";
const RELAY_ADMIN_PRIMARY_BASE = "https://relay.anangeo.com";
const RELAY_ADMIN_FALLBACK_BASE = "https://anan-social-relay.as720518.workers.dev";
const RELAY_FETCH_TIMEOUT_MS = 1500;
const RELAY_ADMIN_READ_TIMEOUT_MS = 8000;
const RELAY_ADMIN_WRITE_TIMEOUT_MS = 15000;
const MAX_PROMOTION_BODY_BYTES = 64 * 1024;
const RELAY_PROMOTIONS_SLOT = "<!-- RELAY_PROMOTIONS_SLOT -->";
const MAX_RELAY_PROMOTIONS = 12;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripXmlControlChars(value) {
  let out = "";
  const str = String(value ?? "");
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20) {
      out += str[i];
    }
  }
  return out;
}

function escapeXml(value) {
  return escapeHtml(stripXmlControlChars(value));
}

function sanitizePlainText(value) {
  return stripXmlControlChars(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

function sanitizeHttpUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function formatTaipeiDate(isoValue) {
  const raw = String(isoValue ?? "").trim();
  if (!raw) return "";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return "";
  const taipei = new Date(ms + 8 * 60 * 60 * 1000);
  const y = taipei.getUTCFullYear();
  const m = String(taipei.getUTCMonth() + 1).padStart(2, "0");
  const d = String(taipei.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatRfc2822Date(isoValue) {
  const raw = String(isoValue ?? "").trim();
  const ms = raw ? Date.parse(raw) : NaN;
  const dt = Number.isFinite(ms) ? new Date(ms) : new Date();
  return dt.toUTCString().replace("GMT", "+0000");
}

function normalizePromotion(item, idx) {
  if (!item || typeof item !== "object") return null;
  const title = stripXmlControlChars(item.title ?? "").trim().slice(0, 180);
  const summary = stripXmlControlChars(item.summary ?? "").trim().slice(0, 1200);
  if (!title && !summary) return null;
  const rawId = stripXmlControlChars(item.id ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return {
    id: rawId || `item_${idx + 1}`,
    title: title || "最新實戰動態",
    summary,
    priceSummary: stripXmlControlChars(item.price_summary ?? "").trim().slice(0, 120),
    imageUrl: sanitizeHttpUrl(item.image_url),
    threadsPermalink: sanitizeHttpUrl(item.threads_permalink),
    publishedAt: stripXmlControlChars(item.published_at || item.updated_at || "").trim(),
  };
}

async function fetchRelayPromotions(env) {
  const customUrl = typeof env?.RELAY_PROMOTIONS_URL === "string" ? env.RELAY_PROMOTIONS_URL.trim() : "";
  const endpoint = customUrl || DEFAULT_RELAY_PROMOTIONS_URL;
  if (!sanitizeHttpUrl(endpoint)) return [];

  const endpoints = [endpoint];
  if (!customUrl && endpoint.startsWith("https://relay.anangeo.com/")) {
    endpoints.push(endpoint.replace("https://relay.anangeo.com/", "https://anan-social-relay.as720518.workers.dev/"));
  }

  for (const targetUrl of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(targetUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const list = Array.isArray(data?.promotions) ? data.promotions : [];
      const normalized = [];
      for (let i = 0; i < list.length && normalized.length < MAX_RELAY_PROMOTIONS; i += 1) {
        const item = normalizePromotion(list[i], i);
        if (item) normalized.push(item);
      }
      return normalized;
    } catch {
      // try fallback endpoint if available
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

function renderRelayMediaHtml(item, dateStr, isFeatured) {
  const featuredCls = isFeatured ? " relay-featured-media" : "";
  if (item.imageUrl) {
    return `<div class="relay-card-media${featuredCls}"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>`;
  }
  const stampText = dateStr || "最新發布";
  return [
    `<div class="relay-card-media${featuredCls} relay-card-media-fallback" aria-hidden="true">`,
    `<div class="relay-fallback-frame">`,
    `<span class="relay-fallback-kicker">ANANGEO JOURNAL</span>`,
    `<strong class="relay-fallback-brand">阿男實戰筆記</strong>`,
    `<span class="relay-fallback-date">${escapeHtml(stampText)}</span>`,
    `</div>`,
    `</div>`,
  ].join("");
}

function renderRelayCardHtml(item, { isFeatured }) {
  const dateStr = formatTaipeiDate(item.publishedAt);
  const categoryLabel = "實戰筆記";
  const mediaHtml = renderRelayMediaHtml(item, dateStr, isFeatured);
  const badgeHtml = `<span class="relay-card-badge">${escapeHtml(categoryLabel)}</span>`;
  const dateBadge = dateStr
    ? `<time class="relay-card-date" datetime="${escapeHtml(dateStr)}">${escapeHtml(dateStr)}</time>`
    : "";
  const priceBadge = item.priceSummary
    ? `<span class="relay-card-price">${escapeHtml(item.priceSummary)}</span>`
    : "";
  const metaHtml = `<div class="relay-card-meta">${badgeHtml}${dateBadge}${priceBadge}</div>`;
  const summaryCls = isFeatured ? "relay-card-summary relay-featured-summary" : "relay-card-summary";
  const summaryHtml = item.summary ? `<p class="${summaryCls}">${escapeHtml(item.summary)}</p>` : "";
  const threadsLinkHtml = item.threadsPermalink
    ? `<a class="relay-card-link" href="${escapeHtml(item.threadsPermalink)}" target="_blank" rel="noopener noreferrer">在 Threads 查看 →</a>`
    : "";
  const readBtnHtml = `<button type="button" class="relay-read-btn" data-relay-open="${escapeHtml(item.id)}">閱讀全文 →</button>`;
  const cardCls = isFeatured ? "relay-update-card relay-featured-card" : "relay-update-card relay-grid-card";
  const bodyCls = isFeatured ? "relay-card-body relay-featured-body" : "relay-card-body";
  const titleCls = isFeatured ? "relay-card-title relay-featured-title" : "relay-card-title";

  return [
    `<article class="${cardCls}" data-relay-card="true" data-relay-id="${escapeHtml(item.id)}" data-relay-title="${escapeHtml(item.title)}" data-relay-date="${escapeHtml(dateStr)}" data-relay-category="${escapeHtml(categoryLabel)}" data-relay-price="${escapeHtml(item.priceSummary)}" data-relay-image="${escapeHtml(item.imageUrl)}" data-relay-threads="${escapeHtml(item.threadsPermalink)}" data-relay-body="${escapeHtml(item.summary)}">`,
    mediaHtml,
    `<div class="${bodyCls}">`,
    metaHtml,
    `<h3 class="${titleCls}">${escapeHtml(item.title)}</h3>`,
    summaryHtml,
    `<div class="relay-card-foot">${readBtnHtml}${threadsLinkHtml}</div>`,
    `</div>`,
    `</article>`,
  ].join("");
}

function renderPromotionsHtmlSection(promotions) {
  if (!promotions.length) return "";
  const [leadItem, ...restItems] = promotions;
  const featuredHtml = renderRelayCardHtml(leadItem, { isFeatured: true });
  const gridHtml =
    restItems.length > 0
      ? [
          `        <div class="relay-updates-grid relay-blog-grid" data-grid-count="${restItems.length}">`,
          ...restItems.map((item) => `          ${renderRelayCardHtml(item, { isFeatured: false })}`),
          `        </div>`,
        ].join("\n")
      : "";

  const lines = [
    `<section class="section relay-updates-section" id="relay-updates" aria-label="最新動態與精選文章">`,
    `      <div class="container">`,
    `        <div class="relay-updates-head">`,
    `          <div>`,
    `            <p class="eyebrow">EDITORIAL JOURNAL・最新動態</p>`,
    `            <h2>最新動態與精選文章</h2>`,
    `            <p class="section-lede">阿男同步發布的實戰筆記與公開更新，點擊任一文章即可展開完整閱讀。</p>`,
    `          </div>`,
    `          <span class="pill pill-teal">共 ${promotions.length} 篇精選文章</span>`,
    `        </div>`,
    `        <div class="relay-featured-wrap">`,
    `          ${featuredHtml}`,
    `        </div>`,
  ];
  if (gridHtml) {
    lines.push(gridHtml);
  }
  lines.push(`      </div>`, `    </section>`);
  return lines.join("\n");
}

function injectPromotionsIntoHtml(html, promotions) {
  if (!promotions.length || !html.includes(RELAY_PROMOTIONS_SLOT)) {
    return null;
  }
  const sectionHtml = renderPromotionsHtmlSection(promotions);
  return html.replace(RELAY_PROMOTIONS_SLOT, () => sectionHtml);
}

function injectPromotionsIntoRss(xml, promotions) {
  if (!promotions.length) return null;
  const itemBlocks = promotions
    .map((item) => {
      const link = item.threadsPermalink || "https://anangeo.com/#relay-updates";
      const descParts = [];
      if (item.summary) descParts.push(item.summary);
      if (item.priceSummary) descParts.push(`方案／備註：${item.priceSummary}`);
      const description = descParts.join("｜") || item.title;
      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(`anangeo-relay-${item.id}`)}</guid>`,
        `      <pubDate>${escapeXml(formatRfc2822Date(item.publishedAt))}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n\n");

  const firstItemIdx = xml.indexOf("<item>");
  if (firstItemIdx !== -1) {
    return `${xml.slice(0, firstItemIdx)}${itemBlocks.trimStart()}\n\n    ${xml.slice(firstItemIdx)}`;
  }
  const closeChannelIdx = xml.lastIndexOf("</channel>");
  if (closeChannelIdx !== -1) {
    return `${xml.slice(0, closeChannelIdx)}\n${itemBlocks}\n  ${xml.slice(closeChannelIdx)}`;
  }
  return null;
}

function injectPromotionsIntoLlmsFull(text, promotions) {
  if (!promotions.length) return null;
  const latestDate = formatTaipeiDate(promotions[0]?.publishedAt);
  const lines = [
    "",
    "## 9. 最新實戰動態與公開更新（LINE@ 自動同步）",
  ];
  if (latestDate) {
    lines.push(`- **最新同步日期**：${latestDate}`);
  }
  for (const item of promotions) {
    const title = sanitizePlainText(item.title);
    const summary = sanitizePlainText(item.summary);
    const price = sanitizePlainText(item.priceSummary);
    const dateStr = formatTaipeiDate(item.publishedAt);
    const parts = [];
    if (summary) parts.push(summary);
    if (price) parts.push(price);
    if (item.threadsPermalink) parts.push(`原文：${item.threadsPermalink}`);
    const datePrefix = dateStr ? `（${dateStr}）` : "";
    const detail = parts.length ? `：${parts.join("｜")}` : "";
    lines.push(`- **${title}**${datePrefix}${detail}`);
  }
  return `${text.trimEnd()}\n${lines.join("\n")}\n`;
}

function buildInjectedResponse(originalResp, newBody, fallbackContentType) {
  const headers = new Headers(originalResp.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("cache-control", "public, max-age=60");
  const ct = headers.get("content-type") || "";
  if (!ct) {
    headers.set("content-type", fallbackContentType);
  } else if (!ct.toLowerCase().includes("charset=")) {
    headers.set("content-type", `${ct}; charset=utf-8`);
  }
  return new Response(newBody, {
    status: originalResp.status,
    statusText: originalResp.statusText,
    headers,
  });
}

function withUtf8Charset(response) {
  const ct = response.headers.get("content-type");
  if (!ct) return response;
  const lower = ct.toLowerCase();
  const isTargetText =
    lower.startsWith("text/html") ||
    lower.startsWith("text/plain") ||
    lower.startsWith("text/markdown") ||
    lower.startsWith("application/rss+xml") ||
    lower.startsWith("application/xml") ||
    lower.startsWith("text/xml");
  if (!isTargetText || lower.includes("charset=")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("content-type", `${ct}; charset=utf-8`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withAdminNoIndexHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, nofollow");
  const ct = (headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("text/html") || pathname === "/admin/" || pathname.endsWith("/index.html")) {
    headers.set("cache-control", "no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function adminProxyJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function resolveRelayAdminBaseUrls(env) {
  const custom =
    typeof env?.RELAY_ADMIN_BASE_URL === "string"
      ? env.RELAY_ADMIN_BASE_URL.trim().replace(/\/+$/, "")
      : "";
  if (custom) {
    if (!sanitizeHttpUrl(custom)) return null;
    return [custom];
  }
  return [RELAY_ADMIN_PRIMARY_BASE, RELAY_ADMIN_FALLBACK_BASE];
}

async function forwardRelayAdminRequest({ baseUrls, pathAndQuery, method, token, bodyJson, timeoutMs }) {
  for (let i = 0; i < baseUrls.length; i += 1) {
    const targetUrl = `${baseUrls[i]}${pathAndQuery}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (bodyJson !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      const resp = await fetch(targetUrl, {
        method,
        headers,
        body: bodyJson,
        signal: controller.signal,
      });
      if (resp.status >= 500 && i < baseUrls.length - 1) {
        try {
          await resp.body?.cancel();
        } catch {}
        continue;
      }
      const rawText = await resp.text();
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return adminProxyJsonResponse(parsed, resp.status);
      }
      return adminProxyJsonResponse(
        {
          ok: resp.ok,
          error: resp.ok ? "貼文中繼回傳非預期格式。" : `貼文中繼暫時無法回應（HTTP ${resp.status}）。`,
        },
        resp.status
      );
    } catch {
      if (i < baseUrls.length - 1) continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return adminProxyJsonResponse(
    {
      ok: false,
      code: "RELAY_UPSTREAM_UNAVAILABLE",
      error: "無法連線至貼文中繼服務，請稍後再試。",
    },
    502
  );
}

async function handleAdminPromotionsProxy(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  // 嚴格驗證站長登入 Session（未登入一律 401，合夥人一律 403）
  const authorized = await isAdminAuthorized(request, env);
  if (!authorized) {
    const sessionCheck = await verifySessionRequest(request, env);
    if (sessionCheck.ok && sessionCheck.role === "partner") {
      return adminProxyJsonResponse(
        { ok: false, code: "FORBIDDEN", error: "合夥人權限無法管理官網貼文。" },
        403
      );
    }
    return adminProxyJsonResponse(
      { ok: false, code: "UNAUTHORIZED", error: "請先輸入站長管理密碼登入後台。" },
      401
    );
  }

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "POST" && method !== "DELETE") {
    return adminProxyJsonResponse(
      { ok: false, code: "METHOD_NOT_ALLOWED", error: "此端點僅支援 GET、POST 與 DELETE。" },
      405
    );
  }

  const relayAdminToken = typeof env?.RELAY_ADMIN_TOKEN === "string" ? env.RELAY_ADMIN_TOKEN.trim() : "";
  if (!relayAdminToken) {
    return adminProxyJsonResponse(
      {
        ok: false,
        code: "RELAY_ADMIN_TOKEN_NOT_CONFIGURED",
        error: "尚未設定官網貼文管理權杖（RELAY_ADMIN_TOKEN），請於 Cloudflare Workers 後台新增此 Secret 後即可使用。",
      },
      503
    );
  }

  const tenant = (env?.RELAY_TENANT_SLUG || DEFAULT_RELAY_TENANT_SLUG).trim() || DEFAULT_RELAY_TENANT_SLUG;
  const baseUrls = resolveRelayAdminBaseUrls(env);
  if (!baseUrls) {
    return adminProxyJsonResponse(
      { ok: false, code: "INVALID_RELAY_BASE_URL", error: "RELAY_ADMIN_BASE_URL 格式無效。" },
      500
    );
  }

  const reqUrl = new URL(request.url);

  if (method === "GET") {
    const params = new URLSearchParams({ tenant });
    const rawLimit = reqUrl.searchParams.get("limit");
    if (rawLimit !== null && rawLimit.trim() !== "") {
      const limitNum = Number(rawLimit);
      if (Number.isInteger(limitNum) && limitNum >= 1 && limitNum <= 50) {
        params.set("limit", String(limitNum));
      }
    }
    return forwardRelayAdminRequest({
      baseUrls,
      pathAndQuery: `/api/admin/promotions?${params.toString()}`,
      method: "GET",
      token: relayAdminToken,
      timeoutMs: RELAY_ADMIN_READ_TIMEOUT_MS,
    });
  }

  if (method === "POST") {
    let rawBody = "";
    try {
      rawBody = await request.text();
    } catch {
      return adminProxyJsonResponse({ ok: false, code: "INVALID_BODY", error: "無法讀取貼文內容。" }, 400);
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PROMOTION_BODY_BYTES) {
      return adminProxyJsonResponse({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "貼文資料量超過上限。" }, 413);
    }
    let body = null;
    try {
      body = rawBody.trim() ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return adminProxyJsonResponse({ ok: false, code: "INVALID_JSON", error: "請傳入正確的 JSON 物件。" }, 400);
    }

    const title = stripXmlControlChars(body.title ?? "").trim().slice(0, 180);
    const summary = stripXmlControlChars(body.summary ?? "").trim().slice(0, 1200);
    const priceSummary = stripXmlControlChars(body.price_summary ?? "").trim().slice(0, 120);
    const rawImageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";
    const publishToThreads = Boolean(body.publish_to_threads);

    if (!title) {
      return adminProxyJsonResponse({ ok: false, code: "MISSING_TITLE", error: "請填寫貼文標題。" }, 400);
    }
    if (!summary) {
      return adminProxyJsonResponse({ ok: false, code: "MISSING_SUMMARY", error: "請填寫貼文內容摘要。" }, 400);
    }

    let safeImageUrl = "";
    if (rawImageUrl) {
      safeImageUrl = sanitizeHttpUrl(rawImageUrl);
      if (!safeImageUrl) {
        return adminProxyJsonResponse(
          { ok: false, code: "INVALID_IMAGE_URL", error: "圖片網址必須為有效的 https:// 或 http:// 公開連結。" },
          400
        );
      }
    }

    // 強制注入伺服器端 tenant_slug，絕不信任前端傳入的租戶
    const upstreamPayload = {
      tenant_slug: tenant,
      title,
      summary,
      price_summary: priceSummary,
      image_url: safeImageUrl,
      publish_to_threads: publishToThreads,
    };

    return forwardRelayAdminRequest({
      baseUrls,
      pathAndQuery: "/api/admin/promotions",
      method: "POST",
      token: relayAdminToken,
      bodyJson: JSON.stringify(upstreamPayload),
      timeoutMs: RELAY_ADMIN_WRITE_TIMEOUT_MS,
    });
  }

  // DELETE /api/admin/promotions?id=...
  const promoId = (reqUrl.searchParams.get("id") || "").trim();
  if (!promoId || promoId.length > 128 || /[\s\u0000-\u001f\u007f]/.test(promoId)) {
    return adminProxyJsonResponse({ ok: false, code: "INVALID_ID", error: "請提供有效的貼文編號。" }, 400);
  }
  const delParams = new URLSearchParams({ tenant, id: promoId });
  return forwardRelayAdminRequest({
    baseUrls,
    pathAndQuery: `/api/admin/promotions?${delParams.toString()}`,
    method: "DELETE",
    token: relayAdminToken,
    timeoutMs: RELAY_ADMIN_READ_TIMEOUT_MS,
  });
}

function createSmartFetch(url, env) {
  const selfHosts = new Set([url.hostname, "anangeo.com", "www.anangeo.com"]);
  return (input, init) => {
    const target = typeof input === "string" ? input : input?.url || "";
    try {
      const parsed = new URL(target);
      if (env?.ASSETS && selfHosts.has(parsed.hostname)) {
        return env.ASSETS.fetch(new Request(parsed.toString(), init)).then(withUtf8Charset);
      }
    } catch {}
    return fetch(input, init);
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 正規化 www.anangeo.com → 301 永久轉向 https://anangeo.com
    if (url.hostname.toLowerCase() === "www.anangeo.com") {
      const target = `https://anangeo.com${url.pathname}${url.search}`;
      return new Response(null, {
        status: 301,
        headers: {
          Location: target,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 2. API 端點：即時基礎初檢、名單解鎖與雲端手機後台（含 /api/admin/search-competitors）
    if (url.pathname === "/api/check") {
      return handleApiCheck({ request, env, fetch: createSmartFetch(url, env) });
    }
    if (url.pathname === "/api/lead") {
      return handleApiLead({ request, env });
    }
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    if (normalizedPath === "/api/admin/promotions") {
      return handleAdminPromotionsProxy(request, env);
    }
    if (
      url.pathname === "/api/admin/search-competitors" ||
      url.pathname === "/api/admin" ||
      url.pathname.startsWith("/api/admin/")
    ) {
      return handleApiAdmin({ request, env, fetch: createSmartFetch(url, env) });
    }

    // 2.5 正規化 /admin → 301 轉向 /admin/，確保相對資源與 PWA scope 一致
    if (url.pathname === "/admin") {
      return new Response(null, {
        status: 301,
        headers: {
          Location: `${url.origin}/admin/${url.search}`,
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-store",
        },
      });
    }

    // 3. Markdown 內容協商（僅當 AI 代理明確請求 text/markdown 且不要求 text/html 時）
    const accept = (request.headers.get("accept") || "").toLowerCase();
    if (
      (url.pathname === "/" || url.pathname === "/index.html") &&
      accept.includes("text/markdown") &&
      !accept.includes("text/html")
    ) {
      const mdReq = new Request(new URL("/llms.txt", url.origin).toString(), {
        method: request.method,
        headers: request.headers,
      });
      const mdResp = await env.ASSETS.fetch(mdReq);
      if (mdResp.ok) {
        const headers = new Headers(mdResp.headers);
        headers.set("content-type", "text/markdown; charset=utf-8");
        headers.set("vary", "Accept");
        return new Response(mdResp.body, {
          status: mdResp.status,
          statusText: mdResp.statusText,
          headers,
        });
      }
    }

    // 4. 靜態資產派發並為 text/html、text/plain 補齊 charset=utf-8；/admin/* 與 VIP 專屬頁強制補 noindex
    const assetResp = withUtf8Charset(await env.ASSETS.fetch(request));
    if (
      url.pathname.startsWith("/admin/") ||
      url.pathname === "/guides/store-owner-vip" ||
      url.pathname.startsWith("/guides/store-owner-vip/")
    ) {
      return withAdminNoIndexHeaders(assetResp, url.pathname);
    }

    // 5. LINE@ 中繼即時動態注入（僅 GET 且回應 200；無新貼文或逾時 1.5s 100% 原樣降級）
    if (request.method === "GET" && assetResp.ok) {
      const p = url.pathname;
      if (p === "/" || p === "/index.html") {
        const originalHtml = await assetResp.text();
        if (originalHtml.includes(RELAY_PROMOTIONS_SLOT)) {
          const promotions = await fetchRelayPromotions(env);
          const injected = injectPromotionsIntoHtml(originalHtml, promotions);
          if (injected !== null) {
            return buildInjectedResponse(assetResp, injected, "text/html; charset=utf-8");
          }
        }
        return new Response(originalHtml, {
          status: assetResp.status,
          statusText: assetResp.statusText,
          headers: assetResp.headers,
        });
      }

      if (p === "/rss.xml") {
        const promotions = await fetchRelayPromotions(env);
        if (promotions.length > 0) {
          const originalXml = await assetResp.text();
          const injected = injectPromotionsIntoRss(originalXml, promotions);
          if (injected !== null) {
            return buildInjectedResponse(assetResp, injected, "application/rss+xml; charset=utf-8");
          }
          return new Response(originalXml, {
            status: assetResp.status,
            statusText: assetResp.statusText,
            headers: assetResp.headers,
          });
        }
      }

      if (p === "/llms-full.txt") {
        const promotions = await fetchRelayPromotions(env);
        if (promotions.length > 0) {
          const originalTxt = await assetResp.text();
          const injected = injectPromotionsIntoLlmsFull(originalTxt, promotions);
          if (injected !== null) {
            return buildInjectedResponse(assetResp, injected, "text/plain; charset=utf-8");
          }
          return new Response(originalTxt, {
            status: assetResp.status,
            statusText: assetResp.statusText,
            headers: assetResp.headers,
          });
        }
      }
    }

    return assetResp;
  },
};
