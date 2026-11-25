import { onRequest as handleApiCheck } from "./functions/api/check.js";
import { onRequest as handleApiLead } from "./functions/api/lead.js";
import { onRequest as handleApiAdmin } from "./functions/api/admin.js";

function withUtf8Charset(response) {
  const ct = response.headers.get("content-type");
  if (!ct) return response;
  const lower = ct.toLowerCase();
  const isTargetText =
    lower.startsWith("text/html") ||
    lower.startsWith("text/plain") ||
    lower.startsWith("text/markdown");
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

    // 2. API 端點：即時基礎初檢、名單解鎖與雲端手機後台
    if (url.pathname === "/api/check") {
      return handleApiCheck({ request, env, fetch: createSmartFetch(url, env) });
    }
    if (url.pathname === "/api/lead") {
      return handleApiLead({ request, env });
    }
    if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
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
    return assetResp;
  },
};
