import { onRequest as handleApiCheck } from "./functions/api/check.js";
import { onRequest as handleApiLead } from "./functions/api/lead.js";
import { onRequest as handleApiAdmin } from "./functions/api/admin.js";

const DEFAULT_RELAY_PROMOTIONS_URL = "https://relay.anangeo.com/api/promotions?tenant=anan";
const RELAY_FETCH_TIMEOUT_MS = 1500;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const list = Array.isArray(data?.promotions) ? data.promotions : [];
    const normalized = [];
    for (let i = 0; i < list.length && normalized.length < MAX_RELAY_PROMOTIONS; i += 1) {
      const item = normalizePromotion(list[i], i);
      if (item) normalized.push(item);
    }
    return normalized;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function renderPromotionsHtmlSection(promotions) {
  if (!promotions.length) return "";
  const cards = promotions
    .map((item) => {
      const dateStr = formatTaipeiDate(item.publishedAt);
      const mediaHtml = item.imageUrl
        ? `<div class="relay-card-media"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>`
        : "";
      const dateBadge = dateStr ? `<span class="relay-card-date">${escapeHtml(dateStr)}</span>` : "";
      const priceBadge = item.priceSummary
        ? `<span class="relay-card-price">${escapeHtml(item.priceSummary)}</span>`
        : "";
      const metaHtml = dateBadge || priceBadge ? `<div class="relay-card-meta">${dateBadge}${priceBadge}</div>` : "";
      const summaryHtml = item.summary ? `<p class="relay-card-summary">${escapeHtml(item.summary)}</p>` : "";
      const footHtml = item.threadsPermalink
        ? `<div class="relay-card-foot"><a class="relay-card-link" href="${escapeHtml(item.threadsPermalink)}" target="_blank" rel="noopener noreferrer">查看 Threads 原文 →</a></div>`
        : "";

      return [
        `<article class="relay-update-card" data-relay-id="${escapeHtml(item.id)}">`,
        mediaHtml,
        `<div class="relay-card-body">`,
        metaHtml,
        `<h3 class="relay-card-title">${escapeHtml(item.title)}</h3>`,
        summaryHtml,
        footHtml,
        `</div>`,
        `</article>`,
      ].join("");
    })
    .join("\n          ");

  return [
    `<section class="section relay-updates-section" id="relay-updates" aria-label="最新實戰動態與公開更新">`,
    `      <div class="container">`,
    `        <div class="relay-updates-head">`,
    `          <div>`,
    `            <p class="eyebrow">LIVE FIELD UPDATES・LINE@ 即時同步發布</p>`,
    `            <h2>最新實戰動態與公開更新</h2>`,
    `            <p class="section-lede">阿男透過官方 LINE 同步發布的最新 GEO 實測筆記、工具更新與公開公告（自動同步至首頁、RSS 與 llms-full.txt）。</p>`,
    `          </div>`,
    `          <span class="pill pill-teal">已同步 ${promotions.length} 則最新動態</span>`,
    `        </div>`,
    `        <div class="relay-updates-grid">`,
    `          ${cards}`,
    `        </div>`,
    `      </div>`,
    `    </section>`,
  ].join("\n");
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

    // 4. 靜態資產派發並為 text/html、text/plain 補齊 charset=utf-8；/admin/* 強制補 noindex
    const assetResp = withUtf8Charset(await env.ASSETS.fetch(request));
    if (url.pathname.startsWith("/admin/")) {
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
